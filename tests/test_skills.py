"""Behaviour of the builtin skills."""

from __future__ import annotations

import json
import time

import pytest

from jarvis.core.memory import Memory
from jarvis.core.scheduler import Scheduler
from jarvis.skills.calc import UnsafeExpression, evaluate, to_expression


class TestCalculator:
    @pytest.mark.parametrize(
        ("spoken", "expected"),
        [
            ("17 times 3", 51),
            ("240 / 8", 30),
            ("2 plus 2", 4),
            ("100 minus 1", 99),
            ("10 divided by 4", 2.5),
            ("2 to the power of 8", 256),
            ("7 squared", 49),
            ("1,000 + 1", 1001),
        ],
    )
    def test_spoken_arithmetic(self, spoken, expected):
        assert evaluate(to_expression(spoken)) == expected

    @pytest.mark.parametrize(
        "hostile",
        [
            "__import__('os').system('rm -rf /')",
            "open('/etc/passwd').read()",
            "[x for x in range(10)]",
            "lambda: 1",
            "1 if True else 2",
            "print(1)",
        ],
    )
    def test_refuses_anything_that_is_not_arithmetic(self, hostile):
        """No eval() anywhere near user speech."""
        with pytest.raises(UnsafeExpression):
            evaluate(hostile)

    def test_refuses_a_denial_of_service_exponent(self):
        with pytest.raises(UnsafeExpression, match="exponent is too large"):
            evaluate("9 ** 9999999")

    def test_division_by_zero_is_a_message_not_a_crash(self, assistant):
        reply = assistant.ask("what is 5 / 0")
        assert "zero" in reply.speech.lower()


class TestNotes:
    def test_notes_round_trip_to_disk(self, assistant, config):
        assistant.ask("note that the boiler code is 4471")
        assert "boiler code is 4471" in assistant.ask("read my notes").speech

        # A fresh Memory over the same file must see the note.
        reopened = Memory(config.state_file)
        assert reopened.notes()[0]["text"] == "the boiler code is 4471"

    def test_delete_by_position(self, assistant):
        assistant.ask("note that first thing")
        assistant.ask("note that second thing")
        assert "second thing" in assistant.ask("delete note 2").speech
        assert len(assistant.memory.notes()) == 1

    def test_deleting_a_missing_note_says_so(self, assistant):
        assert "no note 9" in assistant.ask("delete note 9").speech

    def test_facts_survive_a_reopen(self, assistant, config):
        assistant.ask("remember that my wifi password is hunter2")
        assert Memory(config.state_file).get_fact("wifi password") == "hunter2"

    def test_unknown_fact_lists_what_is_known(self, assistant):
        assistant.ask("remember that my car is a Civic")
        reply = assistant.ask("what is my boat")
        assert "car" in reply.speech


class TestMemoryDurability:
    def test_a_corrupt_state_file_does_not_stop_startup(self, tmp_path):
        broken = tmp_path / "state.json"
        broken.write_text("{ this is not json")
        memory = Memory(broken)
        assert memory.notes() == []

    def test_writes_are_atomic(self, tmp_path):
        path = tmp_path / "state.json"
        memory = Memory(path)
        memory.add_note("one")
        # No partial temp files left behind, and the file parses.
        assert json.loads(path.read_text())["notes"][0]["text"] == "one"
        assert list(tmp_path.glob("*.tmp")) == []

    def test_history_is_bounded(self, tmp_path):
        memory = Memory(tmp_path / "s.json", history_turns=2)
        for i in range(10):
            memory.remember_exchange(f"q{i}", f"a{i}")
        assert len(memory.transcript()) == 4  # 2 turns = 2 user + 2 assistant


class TestScheduler:
    def test_an_alarm_fires_with_its_message(self):
        fired = []
        scheduler = Scheduler(on_fire=fired.append)
        scheduler.schedule(0.05, "kettle", "Reminder: kettle.")
        time.sleep(0.2)
        assert fired == ["Reminder: kettle."]

    def test_a_cancelled_alarm_stays_silent(self):
        fired = []
        scheduler = Scheduler(on_fire=fired.append)
        alarm = scheduler.schedule(0.1, "nope")
        assert scheduler.cancel(alarm.id) is not None
        time.sleep(0.25)
        assert fired == []

    def test_pending_is_ordered_by_due_time(self):
        scheduler = Scheduler()
        late = scheduler.schedule(60, "late")
        soon = scheduler.schedule(5, "soon")
        assert [a.id for a in scheduler.pending()] == [soon.id, late.id]
        scheduler.shutdown()

    def test_rejects_a_non_positive_delay(self):
        with pytest.raises(ValueError):
            Scheduler().schedule(0, "never")


class TestTimerSkill:
    def test_timer_refuses_absurd_durations(self, assistant):
        assert "twenty-four hours" in assistant.ask("set a timer for 40 hours").speech

    def test_listing_with_nothing_running(self, assistant):
        assert assistant.ask("what timers are running").speech == "No timers running."

    def test_cancelling_a_missing_timer(self, assistant):
        assert "no timer 7" in assistant.ask("cancel timer 7").speech


class TestLaunching:
    def test_launching_is_refused_when_switched_off(self, assistant):
        """allow_launch=False must not open anything, and must say so."""
        reply = assistant.ask("open github")
        assert reply.data["opened"] is False
        assert reply.data["url"] == "https://github.com"

    def test_unknown_site(self, assistant):
        assert "do not know a site" in assistant.ask("open flurbleglorp").speech
