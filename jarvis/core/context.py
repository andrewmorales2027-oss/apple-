"""The handle a skill gets on the rest of the assistant."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:  # pragma: no cover - typing only
    from jarvis.config import Config
    from jarvis.core.memory import Memory
    from jarvis.core.scheduler import Scheduler
    from jarvis.core.skills import Registry


@dataclass
class SkillContext:
    """Passed to any skill whose first parameter is named ``ctx``.

    Skills never import the Assistant; they reach everything they need through
    here, which keeps them independently testable.
    """

    config: "Config"
    memory: "Memory"
    scheduler: "Scheduler"
    #: How a skill announces something the user did not directly ask for
    #: (a timer going off).  Wired to the active front end.
    notify: Callable[[str], None] = lambda message: None
    #: Whether the reasoning path is actually usable right now.  A callable,
    #: not a flag, because the brain is built lazily on first use - and a skill
    #: must never claim Claude is behind it when nothing is.
    brain_ready: Callable[[], bool] = lambda: False
    #: The registry this assistant is running, so a skill can introspect the
    #: others (the help skill) without importing a global.
    registry: "Registry | None" = None
    #: Free-form per-turn detail: the raw utterance, its source, and so on.
    turn: dict[str, Any] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.turn is None:
            self.turn = {}

    @property
    def address(self) -> str:
        return self.config.address_user_as
