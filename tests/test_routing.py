"""The routing table. If these regress, the assistant feels broken."""

from __future__ import annotations

import pytest

ROUTES = [
    ("what time is it", "get_time"),
    ("hey jarvis, what's the time please", "get_time"),
    ("what's the time in Tokyo", "get_time"),
    ("what day is it", "get_date"),
    ("what's the date", "get_date"),
    ("set a timer for 5 minutes", "set_timer"),
    ("remind me to stretch in 20 minutes", "set_timer"),
    ("what timers are running", "list_timers"),
    ("cancel all timers", "cancel_timers"),
    ("note that the spare key is under the mat", "add_note"),
    ("read my notes", "list_notes"),
    ("delete note 2", "delete_note"),
    ("clear my notes", "clear_notes"),
    ("remember that my car is a blue Civic", "remember"),
    ("what's my car", "recall"),
    ("what is 17 times 3", "calculate"),
    ("calculate 240 / 8", "calculate"),
    ("2 + 2", "calculate"),
    ("run diagnostics", "system_status"),
    ("how much memory is free", "system_status"),
    ("what can you do", "list_skills"),
    ("hello", "greet"),
    ("hey jarvis", "greet"),
    ("thank you", "thanks"),
    ("who are you", "identify"),
    ("open github", "open_website"),
    ("search the web for tide times", "web_search"),
    ("who is Ada Lovelace", "wikipedia_lookup"),
    ("forget this conversation", "reset_conversation"),
]


@pytest.mark.parametrize(("utterance", "expected"), ROUTES)
def test_utterance_routes_to_expected_skill(assistant, utterance, expected):
    match = assistant.router.route(utterance)
    assert match is not None, f"{utterance!r} reached no skill at all"
    assert match.skill.name == expected


def test_arguments_are_extracted(assistant):
    match = assistant.router.route("set a timer for 25 minutes")
    assert match.arguments == {"duration": 25.0, "unit": "minutes"}


def test_reminder_captures_its_label(assistant):
    match = assistant.router.route("remind me to take the bins out in 10 minutes")
    assert match.arguments["label"] == "take the bins out"
    assert match.arguments["duration"] == 10.0


@pytest.mark.parametrize(
    "utterance",
    [
        "what do you think about the state of British rail",
        "write me a haiku about latency",
        "why is the sky blue",
    ],
)
def test_open_ended_questions_are_left_for_the_brain(assistant, utterance):
    """A skill firing on these would be confidently wrong."""
    assert assistant.router.route(utterance) is None


def test_recall_beats_wikipedia_for_personal_questions(assistant):
    """'who is my dentist' is memory, not an encyclopaedia lookup."""
    assistant.memory.set_fact("dentist", "Dr Shah")
    match = assistant.router.route("what is my dentist")
    assert match.skill.name == "recall"


def test_ranking_exposes_the_runners_up(assistant):
    ranked = assistant.explain("what time is it")
    assert ranked[0]["skill"] == "get_time"
    assert ranked[0]["routed"] is True


@pytest.mark.parametrize(
    ("utterance", "seconds"),
    [
        ("set a timer for five minutes", 300),
        ("set a timer for ten seconds", 10),
        ("remind me to stretch in twenty five minutes", 1500),
        ("set a timer for half an hour", 1800),
        ("set a timer for a minute", 60),
        ("set a timer for 90 seconds", 90),
    ],
)
def test_spoken_durations_are_understood(assistant, utterance, seconds):
    reply = assistant.ask(utterance)
    assert reply.skill == "set_timer"
    assert reply.data["seconds"] == seconds
    assistant.scheduler.cancel_all()
