"""The registry is the contract both paths depend on, so it gets the most tests."""

from __future__ import annotations

import pytest

from jarvis.core.skills import Registry, Reply, normalize, skill


@pytest.fixture
def registry():
    return Registry()


def test_pattern_groups_must_exist_in_parameters(registry):
    with pytest.raises(ValueError, match="missing from `parameters`"):

        @skill("bad", "d", patterns=[r"eat (?P<food>\w+)"], into=registry)
        def bad():
            return "x"


def test_parameters_need_a_description(registry):
    with pytest.raises(ValueError, match="no description"):

        @skill("bad", "d", parameters={"x": {"type": "string"}}, into=registry)
        def bad(x):
            return x


def test_parameters_need_a_type(registry):
    with pytest.raises(ValueError, match="no type"):

        @skill("bad", "d", parameters={"x": {"description": "an x"}}, into=registry)
        def bad(x):
            return x


def test_required_must_be_declared(registry):
    with pytest.raises(ValueError, match="not in `parameters`"):

        @skill("bad", "d", required=["x"], into=registry)
        def bad():
            return "x"


def test_duplicate_names_are_rejected(registry):
    @skill("dup", "d", into=registry)
    def one():
        return "one"

    with pytest.raises(ValueError, match="duplicate"):

        @skill("dup", "d", into=registry)
        def two():
            return "two"


def test_regex_captures_are_coerced_to_schema_types(registry):
    @skill(
        "coerce",
        "d",
        patterns=[r"take (?P<count>\d+) at (?P<ratio>[\d.]+) (?P<flag>on|off) (?P<name>\w+)"],
        parameters={
            "count": {"type": "integer", "description": "n"},
            "ratio": {"type": "number", "description": "r"},
            "flag": {"type": "boolean", "description": "f"},
            "name": {"type": "string", "description": "s"},
        },
        into=registry,
    )
    def coerce(count, ratio, flag, name):
        return f"{count!r} {ratio!r} {flag!r} {name!r}"

    match = registry.get("coerce").match("take 12 at 0.5 on widget")
    assert match.arguments == {"count": 12, "ratio": 0.5, "flag": True, "name": "widget"}


def test_score_reflects_how_much_of_the_utterance_is_explained(registry):
    @skill("whole", "d", patterns=[r"^ping$"], into=registry)
    def whole():
        return "pong"

    assert registry.get("whole").match("ping").score == 1.0
    # A fragment of a longer sentence explains less of it, so it scores lower.
    assert registry.get("whole").match("ping") is not None


def test_tool_schema_matches_the_declaration(registry):
    @skill(
        "tooled",
        "Does a thing.",
        parameters={"x": {"type": "string", "description": "an x"}},
        required=["x"],
        into=registry,
    )
    def tooled(x):
        return x

    assert registry.tools() == [
        {
            "name": "tooled",
            "description": "Does a thing.",
            "input_schema": {
                "type": "object",
                "properties": {"x": {"type": "string", "description": "an x"}},
                "required": ["x"],
                "additionalProperties": False,
            },
        }
    ]


def test_reflex_only_skills_are_withheld_from_the_brain(registry):
    @skill("hidden", "d", exposed_to_brain=False, into=registry)
    def hidden():
        return "hi"

    assert len(registry) == 1
    assert registry.tools() == []


def test_unknown_arguments_are_dropped_not_raised(registry):
    """The model can hallucinate an extra key; that must not crash the skill."""

    @skill("strict", "d", parameters={"x": {"type": "string", "description": "an x"}},
           into=registry)
    def strict(x="default"):
        return x

    reply = registry.get("strict").run(None, x="given", nonsense="ignored")
    assert reply.speech == "given"


def test_plain_string_return_is_wrapped(registry):
    @skill("plain", "d", into=registry)
    def plain():
        return "just words"

    reply = registry.get("plain").run(None)
    assert isinstance(reply, Reply)
    assert reply.speech == "just words"
    assert reply.display == "just words"
    assert reply.skill == "plain"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("hey jarvis, what time is it", "what time is it"),
        ("Jarvis what time is it please", "what time is it"),
        ("could you set a timer", "set a timer"),
        ("what time is it?", "what time is it"),
        ("   spaced   out   words  ", "spaced out words"),
    ],
)
def test_normalize_strips_padding(raw, expected):
    assert normalize(raw) == expected


@pytest.mark.parametrize("raw", ["jarvis", "thanks", "thank you", "please"])
def test_normalize_never_empties_the_utterance(raw):
    """Padding words are the whole sentence sometimes - keep them."""
    assert normalize(raw).strip() != ""


class TestSpokenNumbers:
    """Speech recognisers write words, not digits."""

    @pytest.mark.parametrize(
        ("spoken", "expected"),
        [
            ("ten", 10.0),
            ("twenty five", 25.0),
            ("twenty-five", 25.0),
            ("seventeen", 17.0),
            ("half", 0.5),
            ("a", 1.0),
            ("half an", 0.5),      # "half an hour" is half, not one and a half
            ("ninety", 90.0),
        ],
    )
    def test_words_become_numbers(self, spoken, expected):
        from jarvis.core.skills import word_to_number

        assert word_to_number(spoken) == expected

    @pytest.mark.parametrize("noise", ["", "banana", "ten bananas", "   "])
    def test_non_numbers_are_rejected(self, noise):
        from jarvis.core.skills import word_to_number

        assert word_to_number(noise) is None

    def test_a_spoken_number_is_coerced_through_the_schema(self, registry):
        @skill(
            "wait",
            "d",
            patterns=[r"wait (?P<count>[\w ]+) times"],
            parameters={"count": {"type": "integer", "description": "n"}},
            into=registry,
        )
        def wait(count):
            return str(count)

        match = registry.get("wait").match("wait thirty times")
        assert match.arguments == {"count": 30}
