"""The Claude tool-use loop, driven by a scripted fake client.

No network: each test hands the brain a queue of responses and asserts on the
requests it built and the tool results it sent back.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from jarvis.brain.claude import ClaudeBrain
from jarvis.core.context import SkillContext
from jarvis.core.memory import Memory
from jarvis.core.scheduler import Scheduler
from jarvis.core.skills import Registry, skill


def text_block(text):
    return SimpleNamespace(type="text", text=text)


def tool_block(name, arguments, block_id="call_1"):
    return SimpleNamespace(type="tool_use", name=name, input=arguments, id=block_id)


def message(blocks, stop_reason="end_turn"):
    return SimpleNamespace(content=blocks, stop_reason=stop_reason)


class FakeStream:
    def __init__(self, result):
        self._result = result

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    @property
    def text_stream(self):
        return (b.text for b in self._result.content if b.type == "text")

    def get_final_message(self):
        return self._result


class FakeMessages:
    def __init__(self, scripted):
        self.scripted = list(scripted)
        self.requests = []

    def stream(self, **request):
        self.requests.append(request)
        if not self.scripted:
            raise AssertionError("the brain made more requests than the test scripted")
        return FakeStream(self.scripted.pop(0))


class FakeClient:
    def __init__(self, scripted):
        self.messages = FakeMessages(scripted)


@pytest.fixture
def registry():
    bucket = Registry()

    @skill(
        "add_two",
        "Add two numbers.",
        parameters={
            "a": {"type": "number", "description": "first"},
            "b": {"type": "number", "description": "second"},
        },
        required=["a", "b"],
        into=bucket,
    )
    def add_two(a, b):
        return f"{a + b}"

    @skill("explode", "Always fails.", into=bucket)
    def explode():
        raise RuntimeError("deliberate failure")

    return bucket


@pytest.fixture
def brain_factory(config, registry, tmp_path):
    def build(scripted):
        context = SkillContext(
            config=config,
            memory=Memory(tmp_path / "state.json"),
            scheduler=Scheduler(),
            registry=registry,
        )
        return ClaudeBrain(config, registry, context, client=FakeClient(scripted))

    return build


def test_a_plain_answer_comes_straight_back(brain_factory):
    brain = brain_factory([message([text_block("It is raining.")])])
    reply = brain.respond("what's the weather", [])
    assert reply.speech == "It is raining."
    assert reply.path == "brain"


def test_a_tool_call_runs_the_skill_and_feeds_the_result_back(brain_factory):
    brain = brain_factory([
        message([tool_block("add_two", {"a": 2, "b": 40})], stop_reason="tool_use"),
        message([text_block("Forty-two.")]),
    ])
    reply = brain.respond("add two and forty", [])

    assert reply.speech == "Forty-two."
    assert reply.data["tools_used"] == ["add_two"]

    # The follow-up request must carry the assistant turn then the result.
    second = brain.client.messages.requests[1]["messages"]
    assert second[-2]["role"] == "assistant"
    result_turn = second[-1]
    assert result_turn["role"] == "user"
    assert result_turn["content"][0]["tool_use_id"] == "call_1"
    assert "42" in result_turn["content"][0]["content"]


def test_parallel_results_go_back_in_one_user_message(brain_factory):
    """Splitting them teaches the model to stop calling tools in parallel."""
    brain = brain_factory([
        message(
            [tool_block("add_two", {"a": 1, "b": 1}, "c1"),
             tool_block("add_two", {"a": 2, "b": 2}, "c2")],
            stop_reason="tool_use",
        ),
        message([text_block("Two and four.")]),
    ])
    brain.respond("add them", [])

    follow_up = brain.client.messages.requests[1]["messages"][-1]
    assert follow_up["role"] == "user"
    assert [block["tool_use_id"] for block in follow_up["content"]] == ["c1", "c2"]


def test_a_failing_skill_becomes_an_error_result_not_a_crash(brain_factory):
    brain = brain_factory([
        message([tool_block("explode", {})], stop_reason="tool_use"),
        message([text_block("That one failed.")]),
    ])
    reply = brain.respond("blow up", [])

    assert reply.speech == "That one failed."
    result = brain.client.messages.requests[1]["messages"][-1]["content"][0]
    assert result["is_error"] is True
    assert "deliberate failure" in result["content"]


def test_an_unknown_tool_is_reported_back_to_the_model(brain_factory):
    brain = brain_factory([
        message([tool_block("nonexistent", {})], stop_reason="tool_use"),
        message([text_block("My mistake.")]),
    ])
    brain.respond("do something odd", [])

    result = brain.client.messages.requests[1]["messages"][-1]["content"][0]
    assert result["is_error"] is True
    assert "No such skill" in result["content"]


def test_a_refusal_is_handled_before_reading_content(brain_factory):
    brain = brain_factory([message([], stop_reason="refusal")])
    reply = brain.respond("something disallowed", [])
    assert "not able to answer" in reply.speech


def test_the_loop_is_capped_and_ends_with_words(brain_factory, config):
    """A model stuck in a tool loop must still produce a spoken answer."""
    config.max_tool_rounds = 3
    looping = [
        message([tool_block("add_two", {"a": 1, "b": 1}, f"c{i}")], stop_reason="tool_use")
        for i in range(3)
    ]
    brain = brain_factory([*looping, message([text_block("Enough of that.")])])
    reply = brain.respond("loop forever", [])

    assert reply.speech == "Enough of that."
    # The final request withholds the tools, which is what breaks the loop.
    assert "tools" not in brain.client.messages.requests[-1]


def test_tokens_are_streamed_as_they_arrive(brain_factory):
    brain = brain_factory([message([text_block("one "), text_block("two")])])
    chunks = []
    brain.respond("say something", [], on_token=chunks.append)
    assert chunks == ["one ", "two"]


def test_tool_calls_are_announced(brain_factory):
    brain = brain_factory([
        message([tool_block("add_two", {"a": 1, "b": 2})], stop_reason="tool_use"),
        message([text_block("Three.")]),
    ])
    seen = []
    brain.respond("add", [], on_tool=lambda name, args: seen.append((name, args)))
    assert seen == [("add_two", {"a": 1, "b": 2})]


def test_the_stable_prompt_is_cached_and_volatile_state_sits_after_it(brain_factory):
    brain = brain_factory([message([text_block("ok")])])
    brain.respond("hello", [])

    system = brain.client.messages.requests[0]["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}
    # Volatile per-turn state must come after the breakpoint or it would
    # invalidate the cached prefix on every single turn.
    assert "cache_control" not in system[1]
    assert "Current local time" in system[1]["text"]


def test_history_is_replayed(brain_factory):
    brain = brain_factory([message([text_block("Still raining.")])])
    history = [{"role": "user", "content": "weather?"},
               {"role": "assistant", "content": "Raining."}]
    brain.respond("and now?", history)

    sent = brain.client.messages.requests[0]["messages"]
    assert sent[:2] == history
    assert sent[-1] == {"role": "user", "content": "and now?"}


def test_the_configured_model_and_effort_are_used(brain_factory, config):
    config.model = "claude-opus-5"
    config.effort = "low"
    brain = brain_factory([message([text_block("ok")])])
    brain.respond("hello", [])

    request = brain.client.messages.requests[0]
    assert request["model"] == "claude-opus-5"
    assert request["output_config"] == {"effort": "low"}


def test_skills_are_offered_as_tools(brain_factory):
    brain = brain_factory([message([text_block("ok")])])
    brain.respond("hello", [])
    names = {tool["name"] for tool in brain.client.messages.requests[0]["tools"]}
    assert names == {"add_two", "explode"}


def test_an_empty_answer_still_says_something(brain_factory):
    brain = brain_factory([message([])])
    assert brain.respond("...", []).speech == "I have nothing to add to that."


def test_a_missing_credential_is_explained_not_raised(brain_factory):
    """The SDK resolves auth lazily and raises TypeError, not an APIError."""
    brain = brain_factory([])
    def refuse(**_):
        raise TypeError("Could not resolve authentication method. Expected one of api_key...")
    brain.client.messages.stream = refuse

    reply = brain.respond("hello", [])
    assert "no Anthropic credentials" in reply.speech
    assert reply.data["error"] is True


def test_an_unexpected_failure_is_reported_not_raised(brain_factory):
    brain = brain_factory([])
    def explode(**_):
        raise RuntimeError("something odd")
    brain.client.messages.stream = explode

    reply = brain.respond("hello", [])
    assert "something odd" in reply.speech
