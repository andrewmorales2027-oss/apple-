"""The skill registry.

A skill is declared exactly once and is then usable two different ways:

* the **reflex path** matches it with regular expressions - instant, offline,
  free, and deterministic;
* the **reasoning path** hands the very same function to Claude as a tool, so
  the model can invoke it when an utterance is too loose to pattern-match.

Keeping one definition for both paths is the whole point.  Named groups in a
pattern and properties in the JSON schema are the same arguments, so a skill
never has to be written twice or kept in sync with a parallel tool table.
"""

from __future__ import annotations

import inspect
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

# Politeness and wake-word padding that carries no intent.  Stripped before
# matching so "jarvis, what time is it please" scores like "what time is it".
_PREFIXES = re.compile(
    r"^(?:(?:hey|ok|okay|yo|hi|hello)\s+)?(?:jarvis|computer)\b[\s,.!:-]*"
    r"|^(?:please|could you|can you|would you|will you|i want you to|"
    r"i'd like you to|go ahead and)\s+",
    re.IGNORECASE,
)
_SUFFIXES = re.compile(
    r"[\s,]*(?:please|thanks|thank you|for me|jarvis)\s*[.!?]*$", re.IGNORECASE
)
_TRUTHY = {"1", "true", "yes", "y", "on", "enable", "enabled"}

# Speech recognisers write "ten minutes", not "10 minutes", so a voice
# assistant that only understands digits mishears half of what it is told.
_UNITS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "half": 0.5,
}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
         "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
NUMBER_WORDS: dict[str, float] = {**_UNITS, **_TENS}
#: Regex alternation matching any spoken number this module understands.
#: Longest first, so "seventeen" is not eaten by "seven".
NUMBER_WORD_PATTERN = "|".join(sorted(NUMBER_WORDS, key=len, reverse=True))


def word_to_number(text: str) -> float | None:
    """"twenty five" -> 25.0. Returns None if it is not a spoken number."""
    parts = [p for p in text.strip().lower().replace("-", " ").split() if p]
    if not parts or any(part not in NUMBER_WORDS for part in parts):
        return None
    if len(parts) > 1:
        # "half an hour" is half, not half plus one: the article is grammar,
        # not arithmetic. Alone, though, "a minute" really does mean one.
        parts = [part for part in parts if part not in ("a", "an")] or parts
    return float(sum(NUMBER_WORDS[part] for part in parts))


def normalize(text: str) -> str:
    """Collapse whitespace and strip wake words, politeness and end punctuation.

    Casing is preserved: captured groups often become user-visible content
    (a note's body, a timer's label) and lowercasing them would be lossy.
    """
    cleaned = " ".join(text.split())
    # Repeat: "hey jarvis, could you ..." has two strippable prefixes.
    for _ in range(3):
        stripped = _PREFIXES.sub("", cleaned, count=1).strip()
        # "jarvis" or "thanks" on its own IS the utterance - stripping padding
        # must never leave us with nothing to match against.
        if not stripped:
            break
        without_suffix = _SUFFIXES.sub("", stripped, count=1).strip()
        if without_suffix:
            stripped = without_suffix
        if stripped == cleaned:
            break
        cleaned = stripped
    return cleaned.strip().rstrip("?!.").strip() or " ".join(text.split())


@dataclass
class Reply:
    """What a skill (or the brain) hands back to the caller."""

    speech: str
    display: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    skill: str | None = None
    confidence: float = 1.0
    #: "reflex" (regex), "brain" (Claude), or "fallback" (nothing understood).
    path: str = "reflex"

    def __post_init__(self) -> None:
        if self.display is None:
            self.display = self.speech

    def as_dict(self) -> dict[str, Any]:
        return {
            "speech": self.speech,
            "display": self.display,
            "data": self.data,
            "skill": self.skill,
            "confidence": round(self.confidence, 3),
            "path": self.path,
        }


@dataclass(frozen=True)
class Match:
    """A successful reflex match: which skill, how sure, and with what args."""

    skill: "Skill"
    score: float
    arguments: dict[str, Any]


@dataclass
class Skill:
    """A single capability. Built by the :func:`skill` decorator."""

    name: str
    description: str
    fn: Callable[..., Any]
    patterns: tuple[re.Pattern[str], ...] = ()
    parameters: dict[str, dict[str, Any]] = field(default_factory=dict)
    required: tuple[str, ...] = ()
    examples: tuple[str, ...] = ()
    #: Offered to Claude as a tool. Turn off for skills that only make sense
    #: as a literal phrase (greetings) or that the model must not self-trigger.
    exposed_to_brain: bool = True
    #: Multiplies the reflex score. Above 1.0 wins ties against broader skills.
    weight: float = 1.0
    #: Set when the underlying function wants the SkillContext as first arg.
    wants_context: bool = False

    def match(self, text: str) -> Match | None:
        """Best regex match for ``text``, or ``None``.

        The score is how much of the utterance the pattern accounts for, so a
        pattern that explains the whole sentence beats one that catches a
        fragment of it.
        """
        best: Match | None = None
        for pattern in self.patterns:
            found = pattern.search(text)
            if found is None:
                continue
            covered = len(found.group(0).strip())
            score = min(1.0, covered / max(len(text), 1) * self.weight)
            if best is None or score > best.score:
                best = Match(self, score, self._coerce(found.groupdict()))
        return best

    def _coerce(self, groups: dict[str, str | None]) -> dict[str, Any]:
        """Turn regex captures into the types the JSON schema promises."""
        arguments: dict[str, Any] = {}
        for key, raw in groups.items():
            if raw is None:
                continue
            kind = self.parameters.get(key, {}).get("type", "string")
            if kind in ("integer", "number"):
                spoken = word_to_number(raw)
                if spoken is not None:
                    arguments[key] = int(spoken) if kind == "integer" else spoken
                    continue
            try:
                if kind == "integer":
                    arguments[key] = int(raw)
                elif kind == "number":
                    arguments[key] = float(raw)
                elif kind == "boolean":
                    arguments[key] = raw.strip().lower() in _TRUTHY
                else:
                    arguments[key] = raw.strip()
            except ValueError:
                # A capture that will not convert is worse than no capture:
                # let the skill fall back to its own default.
                continue
        return arguments

    def run(self, context: "SkillContext", **arguments: Any) -> Reply:
        """Invoke the skill, normalising whatever it returns into a Reply."""
        accepted = self._accepted_arguments()
        if accepted is not None:
            arguments = {k: v for k, v in arguments.items() if k in accepted}
        result = self.fn(context, **arguments) if self.wants_context else self.fn(**arguments)
        if isinstance(result, Reply):
            reply = result
        else:
            reply = Reply(speech=str(result))
        reply.skill = reply.skill or self.name
        return reply

    def _accepted_arguments(self) -> set[str] | None:
        """Parameter names the function takes, or None if it takes **kwargs."""
        signature = inspect.signature(self.fn)
        names = set()
        for index, parameter in enumerate(signature.parameters.values()):
            if parameter.kind is inspect.Parameter.VAR_KEYWORD:
                return None
            if self.wants_context and index == 0:
                continue
            names.add(parameter.name)
        return names

    def as_tool(self) -> dict[str, Any]:
        """The Anthropic tool definition for this skill."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": self.parameters,
                "required": list(self.required),
                "additionalProperties": False,
            },
        }


class Registry:
    """Every known skill, in declaration order."""

    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {}

    def register(self, entry: Skill) -> Skill:
        if entry.name in self._skills:
            raise ValueError(f"duplicate skill name: {entry.name}")
        self._skills[entry.name] = entry
        return entry

    def get(self, name: str) -> Skill | None:
        return self._skills.get(name)

    def __iter__(self) -> Iterator[Skill]:
        return iter(self._skills.values())

    def __len__(self) -> int:
        return len(self._skills)

    def __contains__(self, name: object) -> bool:
        return name in self._skills

    def tools(self) -> list[dict[str, Any]]:
        """Tool definitions for the skills the brain is allowed to call."""
        return [s.as_tool() for s in self if s.exposed_to_brain]

    def clear(self) -> None:
        self._skills.clear()


registry = Registry()


def skill(
    name: str,
    description: str,
    *,
    patterns: list[str] | tuple[str, ...] = (),
    parameters: dict[str, dict[str, Any]] | None = None,
    required: list[str] | tuple[str, ...] = (),
    examples: list[str] | tuple[str, ...] = (),
    exposed_to_brain: bool = True,
    weight: float = 1.0,
    into: Registry | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Declare a skill.

    Named groups in ``patterns`` must line up with keys in ``parameters`` -
    that correspondence is what lets one function serve both the reflex path
    and Claude's tool-use path::

        @skill(
            "set_timer",
            "Start a countdown timer.",
            patterns=[r"set a timer for (?P<minutes>\\d+) minutes?"],
            parameters={"minutes": {"type": "integer", "description": "..."}},
            required=["minutes"],
        )
        def set_timer(ctx, minutes: int) -> str:
            ...

    A function whose first parameter is named ``ctx`` receives the
    :class:`SkillContext` and does not have to declare it in ``parameters``.
    """

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        parameter_names = list(inspect.signature(fn).parameters)
        wants_context = bool(parameter_names) and parameter_names[0] == "ctx"
        entry = Skill(
            name=name,
            description=description,
            fn=fn,
            patterns=tuple(re.compile(p, re.IGNORECASE) for p in patterns),
            parameters=dict(parameters or {}),
            required=tuple(required),
            examples=tuple(examples),
            exposed_to_brain=exposed_to_brain,
            weight=weight,
            wants_context=wants_context,
        )
        _validate(entry)
        # `into is None`, not `into or registry`: an empty Registry is falsy
        # because it defines __len__, which would silently send every skill
        # to the global registry instead.
        (registry if into is None else into).register(entry)
        fn.skill = entry  # type: ignore[attr-defined]
        return fn

    return decorator


def _validate(entry: Skill) -> None:
    """Catch the mistakes that would otherwise surface as a bad tool call."""
    for pattern in entry.patterns:
        unknown = set(pattern.groupindex) - set(entry.parameters)
        if unknown:
            raise ValueError(
                f"skill {entry.name!r}: pattern captures {sorted(unknown)} "
                "which are missing from `parameters`"
            )
    missing = set(entry.required) - set(entry.parameters)
    if missing:
        raise ValueError(
            f"skill {entry.name!r}: required {sorted(missing)} not in `parameters`"
        )
    for key, schema in entry.parameters.items():
        if "type" not in schema:
            raise ValueError(f"skill {entry.name!r}: parameter {key!r} has no type")
        if "description" not in schema:
            raise ValueError(
                f"skill {entry.name!r}: parameter {key!r} has no description - "
                "the model needs it to call the tool correctly"
            )


# Imported late to avoid a cycle: context.py needs Reply from this module.
from jarvis.core.context import SkillContext  # noqa: E402  isort:skip

__all__ = [
    "Match", "Registry", "Reply", "Skill", "SkillContext", "normalize",
    "registry", "skill", "word_to_number",
]
