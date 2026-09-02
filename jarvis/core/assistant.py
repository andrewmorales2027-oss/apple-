"""The orchestrator: one utterance in, one Reply out."""

from __future__ import annotations

import logging
import os
import random
from pathlib import Path
from typing import Any, Callable

from jarvis.config import Config, load_config
from jarvis.core.context import SkillContext
from jarvis.core.memory import Memory
from jarvis.core.router import Router
from jarvis.core.scheduler import Scheduler
from jarvis.core.skills import Match, Registry, Reply, registry as global_registry

log = logging.getLogger("jarvis")

EMPTY_PROMPTS = [
    "I did not catch that.",
    "Say again?",
    "I am listening.",
]


class Assistant:
    """Reflex first, reasoning second, honesty last.

    ``ask`` tries the regex router, falls back to Claude when one is
    configured, and otherwise admits it did not understand rather than
    inventing something.
    """

    def __init__(
        self,
        config: Config | None = None,
        registry: Registry | None = None,
        brain: Any | None = None,
    ) -> None:
        self.config = config or load_config()
        load_builtin_skills()
        self.registry = registry if registry is not None else global_registry
        self.memory = Memory(self.config.state_file, self.config.history_turns)
        self.scheduler = Scheduler(on_fire=self._on_alarm)
        self.context = SkillContext(
            config=self.config,
            memory=self.memory,
            scheduler=self.scheduler,
            registry=self.registry,
            notify=self._notify,
            brain_ready=lambda: self.brain_ready,
        )
        self.router = Router(self.registry, self.config.reflex_threshold)
        #: Front ends attach here to hear about timers firing.
        self.on_notify: Callable[[str], None] = lambda message: None
        self._brain = brain
        self._brain_checked = brain is not None

    # -- the one method that matters -------------------------------------
    def ask(
        self,
        text: str,
        on_token: Callable[[str], None] | None = None,
        on_tool: Callable[[str, dict[str, Any]], None] | None = None,
        source: str = "text",
    ) -> Reply:
        """Answer one utterance."""
        if not text or not text.strip():
            return Reply(speech=random.choice(EMPTY_PROMPTS), path="fallback")

        self.context.turn = {"utterance": text, "source": source}
        match = self.router.route(text)
        if match is not None:
            reply = self._run_match(match)
            self.memory.remember_exchange(text, reply.speech)
            return reply

        brain = self.brain
        if brain is not None:
            reply = brain.respond(text, self.memory.transcript(), on_token, on_tool)
            # Only the final words go into history. Replaying tool round-trips
            # would bloat every later request and risks an invalid sequence if
            # a result were ever dropped.
            self.memory.remember_exchange(text, reply.speech)
            return reply

        return self._no_idea(text)

    def _run_match(self, match: Match) -> Reply:
        try:
            reply = match.skill.run(self.context, **match.arguments)
        except Exception as exc:  # noqa: BLE001 - report, never crash the loop
            log.exception("skill %s failed", match.skill.name)
            return Reply(
                speech=f"The {match.skill.name.replace('_', ' ')} skill failed: {exc}",
                skill=match.skill.name,
                path="reflex",
                data={"error": True},
            )
        reply.confidence = match.score
        reply.path = "reflex"
        return reply

    def _no_idea(self, text: str) -> Reply:
        """No skill matched and there is no brain to fall back on."""
        near = self.router.best_match(text)
        if near is not None:
            hint = (
                f" Did you mean something like \"{near.skill.examples[0]}\"?"
                if near.skill.examples
                else ""
            )
        else:
            samples = [s.examples[0] for s in self.registry if s.examples][:3]
            hint = f" Try: {'; '.join(samples)}." if samples else ""
        return Reply(
            speech=f"I do not have a skill for that.{hint}",
            path="fallback",
            data={"brain": "unavailable"},
        )

    # -- brain wiring ----------------------------------------------------
    @property
    def brain(self) -> Any | None:
        """The Claude brain, or None when the reasoning path is unavailable."""
        if not self._brain_checked:
            self._brain_checked = True
            self._brain = self._build_brain()
        return self._brain

    def _build_brain(self) -> Any | None:
        from jarvis.brain.claude import ClaudeBrain

        if self.config.brain_enabled is False:
            return None
        if not ClaudeBrain.is_installed():
            if self.config.brain_enabled:
                log.warning("brain_enabled is set but the anthropic package is missing")
            return None
        if self.config.brain_enabled is None and not has_credentials():
            log.info("no Anthropic credentials found - running on skills alone")
            return None
        return ClaudeBrain(self.config, self.registry, self.context)

    @property
    def brain_ready(self) -> bool:
        return self.brain is not None

    # -- notifications ----------------------------------------------------
    def _on_alarm(self, label: str) -> None:
        self._notify(label)

    def _notify(self, message: str) -> None:
        self.on_notify(message)

    # -- introspection -----------------------------------------------------
    def describe(self) -> list[dict[str, Any]]:
        return [
            {
                "name": entry.name,
                "description": entry.description,
                "examples": list(entry.examples),
                "tool": entry.exposed_to_brain,
            }
            for entry in self.registry
        ]

    def explain(self, text: str) -> list[dict[str, Any]]:
        """Why did that route the way it did? Used by ``jarvis explain``."""
        return [
            {
                "skill": match.skill.name,
                "score": round(match.score, 3),
                "arguments": match.arguments,
                "routed": match.score >= self.router.threshold,
            }
            for match in self.router.rank(text)
        ]

    def shutdown(self) -> None:
        self.scheduler.shutdown()
        self.memory.save()


def has_credentials() -> bool:
    """Whether the Anthropic SDK is likely to find a credential.

    An unset ``ANTHROPIC_API_KEY`` does not mean there is nothing: the SDK also
    reads ``ant auth login`` profiles from the config directory.
    """
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    config_home = os.environ.get("XDG_CONFIG_HOME") or (Path.home() / ".config")
    return (Path(config_home) / "anthropic").exists()


def load_builtin_skills() -> None:
    """Import the builtin skill modules so their decorators run."""
    import jarvis.skills  # noqa: F401
