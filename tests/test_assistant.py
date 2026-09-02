"""How the two paths fit together."""

from __future__ import annotations

import pytest

from jarvis import Assistant
from jarvis.core.skills import Registry, Reply, skill


class RecordingBrain:
    """Stands in for Claude so we can see exactly when it gets used."""

    def __init__(self, answer="a considered answer"):
        self.calls = []
        self.answer = answer

    def respond(self, text, history, on_token=None, on_tool=None):
        self.calls.append((text, list(history)))
        if on_token:
            on_token(self.answer)
        return Reply(speech=self.answer, path="brain")


@pytest.fixture
def with_brain(config):
    brain = RecordingBrain()
    instance = Assistant(config, brain=brain)
    yield instance, brain
    instance.shutdown()


def test_the_reflex_path_answers_without_the_brain(with_brain):
    assistant, brain = with_brain
    reply = assistant.ask("what time is it")
    assert reply.path == "reflex"
    assert brain.calls == [], "a pattern match must never cost an API call"


def test_the_brain_takes_what_the_patterns_miss(with_brain):
    assistant, brain = with_brain
    reply = assistant.ask("why do cats knock things off tables")
    assert reply.path == "brain"
    assert brain.calls[0][0] == "why do cats knock things off tables"


def test_the_brain_receives_the_conversation_so_far(with_brain):
    assistant, brain = with_brain
    assistant.ask("what time is it")           # reflex, but still remembered
    assistant.ask("and why does that matter")  # brain
    history = brain.calls[0][1]
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "what time is it"


def test_both_paths_are_recorded_in_history(with_brain):
    assistant, _ = with_brain
    assistant.ask("what time is it")
    assistant.ask("tell me a story")
    assert len(assistant.memory.transcript()) == 4


def test_without_a_brain_it_admits_ignorance(assistant):
    reply = assistant.ask("compose a sonnet about buffer overflows")
    assert reply.path == "fallback"
    assert "do not have a skill" in reply.speech
    assert reply.data["brain"] == "unavailable"


def test_the_fallback_suggests_something_usable(assistant):
    reply = assistant.ask("what tiiime is it")
    assert "Did you mean" in reply.speech or "Try:" in reply.speech


def test_empty_input_is_a_prompt_not_an_error(assistant):
    assert assistant.ask("   ").path == "fallback"


def test_a_broken_skill_is_reported_not_raised(config):
    bucket = Registry()

    @skill("boom", "Fails on purpose.", patterns=[r"^boom$"], into=bucket)
    def boom():
        raise RuntimeError("kaboom")

    instance = Assistant(config, registry=bucket)
    try:
        reply = instance.ask("boom")
        assert reply.data["error"] is True
        assert "kaboom" in reply.speech
    finally:
        instance.shutdown()


def test_the_brain_is_off_when_explicitly_disabled(assistant):
    assert assistant.brain_ready is False


def test_credentials_are_looked_for_beyond_the_env_var(monkeypatch, tmp_path):
    """An unset ANTHROPIC_API_KEY does not mean there is no credential."""
    from jarvis.core.assistant import has_credentials

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    assert has_credentials() is False

    (tmp_path / "anthropic").mkdir()
    assert has_credentials() is True, "an `ant auth login` profile counts"


def test_notifications_reach_the_front_end(assistant):
    heard = []
    assistant.on_notify = heard.append
    assistant.context.scheduler.on_fire("timer done")
    assert heard == ["timer done"]


def test_describe_lists_every_skill(assistant):
    described = assistant.describe()
    assert len(described) == len(assistant.registry)
    assert {"name", "description", "examples", "tool"} <= described[0].keys()
