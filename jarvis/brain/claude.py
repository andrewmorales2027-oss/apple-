"""The reasoning path: Claude, holding the skill registry as its tool belt.

Anything the reflex path cannot pattern-match comes here.  The model gets the
same skills the regex router has, so "set a timer for five minutes" and "I'm
boiling an egg, nudge me when it's done" reach identical code.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

from jarvis.brain.prompts import build_system_prompt
from jarvis.core.context import SkillContext
from jarvis.core.skills import Registry, Reply

log = logging.getLogger("jarvis.brain")

TokenSink = Callable[[str], None]
ToolSink = Callable[[str, dict[str, Any]], None]


class BrainUnavailable(RuntimeError):
    """Raised when the reasoning path cannot be used at all."""


class ClaudeBrain:
    """A streaming tool-use loop over the Messages API."""

    def __init__(
        self,
        config: Any,
        registry: Registry,
        context: SkillContext,
        client: Any | None = None,
    ) -> None:
        self.config = config
        self.registry = registry
        self.context = context
        self._client = client
        self._system = [
            {
                "type": "text",
                "text": build_system_prompt(config.name, config.address_user_as),
                # Everything before this breakpoint (the tool definitions and
                # the persona) is byte-stable across turns, so it can be
                # cached.  Volatile state deliberately goes in the block
                # *after* it, where changing it costs nothing.
                "cache_control": {"type": "ephemeral"},
            }
        ]

    # -- availability ---------------------------------------------------
    @staticmethod
    def is_installed() -> bool:
        try:
            import anthropic  # noqa: F401
        except ImportError:
            return False
        return True

    @property
    def client(self) -> Any:
        """The SDK client, created on first use.

        Credentials are resolved by the SDK itself - an API key in the
        environment, or a profile from ``ant auth login``.  We never read or
        store the key ourselves.
        """
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover - import guard
                raise BrainUnavailable(
                    "the anthropic package is not installed - run "
                    "`pip install anthropic` to enable the reasoning path"
                ) from exc
            try:
                self._client = anthropic.Anthropic()
            except Exception as exc:
                raise BrainUnavailable(f"could not start the Claude client: {exc}") from exc
        return self._client

    # -- the loop -------------------------------------------------------
    def respond(
        self,
        text: str,
        history: list[dict[str, Any]],
        on_token: TokenSink | None = None,
        on_tool: ToolSink | None = None,
    ) -> Reply:
        """Answer ``text``, running skills as tools until the model is done."""
        import anthropic

        messages: list[dict[str, Any]] = [*history, {"role": "user", "content": text}]
        tools = self.registry.tools()
        used: list[str] = []
        spoken = ""

        for round_number in range(self.config.max_tool_rounds + 1):
            if round_number == self.config.max_tool_rounds:
                # Out of rounds. Ask for a plain answer with tools withheld so
                # the turn ends with words rather than another tool call.
                tools = []
            try:
                message = self._send(messages, tools, on_token)
            except anthropic.APIStatusError as exc:
                return self._error_reply(self._explain_status(exc), used)
            except (anthropic.APIConnectionError, anthropic.APITimeoutError):
                return self._error_reply(
                    "I could not reach Anthropic just now. My local skills still work.",
                    used,
                )
            except Exception as exc:  # noqa: BLE001
                # The SDK resolves credentials lazily, at request time, and
                # raises a plain TypeError when it finds none - so a missing
                # key surfaces here rather than as an API error.
                if "authentication" in str(exc).lower():
                    # Expected and actionable, so a one-line warning beats a
                    # stack trace the user can do nothing with.
                    log.warning("no Anthropic credentials resolved")
                    return self._error_reply(
                        "I have no Anthropic credentials, so I am running on "
                        "local skills only. Set ANTHROPIC_API_KEY to wake me "
                        "up properly.",
                        used,
                    )
                log.exception("the reasoning path failed")
                return self._error_reply(f"The reasoning path failed: {exc}", used)

            if message.stop_reason == "refusal":
                return self._error_reply(
                    "I am not able to answer that one.", used, path="brain"
                )

            spoken = _text_of(message)
            if message.stop_reason != "tool_use":
                break

            messages.append({"role": "assistant", "content": message.content})
            calls = [b for b in message.content if b.type == "tool_use"]
            results = []
            for call in calls:
                used.append(call.name)
                if on_tool is not None:
                    on_tool(call.name, dict(call.input or {}))
                results.append(self._run_tool(call))
            # Every result from one assistant turn goes back in a single user
            # message; splitting them teaches the model to stop parallelising.
            messages.append({"role": "user", "content": results})
        else:  # pragma: no cover - the range always breaks or exhausts above
            pass

        if not spoken.strip():
            spoken = "I have nothing to add to that."
        return Reply(
            speech=spoken.strip(),
            skill=used[-1] if used else None,
            path="brain",
            data={"tools_used": used} if used else {},
        )

    def _send(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], on_token: TokenSink | None
    ) -> Any:
        """One streamed request. Returns the accumulated final message."""
        request: dict[str, Any] = {
            "model": self.config.model,
            "max_tokens": self.config.max_tokens,
            "system": [*self._system, {"type": "text", "text": self._volatile_state()}],
            "messages": messages,
        }
        if tools:
            request["tools"] = tools
        if self.config.effort:
            # Effort, not disabled thinking, is the latency/cost dial here:
            # switching thinking off on Opus 5 can put a tool call in the
            # visible text instead of a tool_use block.
            request["output_config"] = {"effort": self.config.effort}

        with self.client.messages.stream(**request) as stream:
            if on_token is not None:
                for chunk in stream.text_stream:
                    on_token(chunk)
            return stream.get_final_message()

    def _volatile_state(self) -> str:
        """Per-turn facts. Sits after the cache breakpoint on purpose."""
        import time

        now = time.localtime()
        lines = [
            f"Current local time: {time.strftime('%A %d %B %Y, %H:%M', now)}.",
            f"Timers running: {len(self.context.scheduler.pending())}.",
            f"Notes stored: {len(self.context.memory.notes())}.",
        ]
        facts = self.context.memory.facts()
        if facts:
            remembered = "; ".join(f"{k} = {v}" for k, v in sorted(facts.items()))
            lines.append(f"Things the user asked you to remember: {remembered}.")
        return "\n".join(lines)

    def _run_tool(self, call: Any) -> dict[str, Any]:
        """Execute one tool call, never letting an exception escape."""
        entry = self.registry.get(call.name)
        if entry is None:
            return _tool_result(call.id, f"No such skill: {call.name}", error=True)
        try:
            # Inputs are parsed JSON from the SDK, never string-matched.
            reply = entry.run(self.context, **dict(call.input or {}))
        except Exception as exc:  # noqa: BLE001 - a failing skill is a result, not a crash
            log.exception("skill %s raised", call.name)
            return _tool_result(call.id, f"{type(exc).__name__}: {exc}", error=True)
        body = reply.display or reply.speech
        if reply.data:
            body = f"{body}\n\n{json.dumps(reply.data, default=str)}"
        return _tool_result(call.id, body)

    @staticmethod
    def _explain_status(exc: Any) -> str:
        import anthropic

        if isinstance(exc, anthropic.AuthenticationError):
            return "My credentials were rejected. Check ANTHROPIC_API_KEY."
        if isinstance(exc, anthropic.RateLimitError):
            return "I am being rate limited. Try again in a moment."
        if isinstance(exc, anthropic.NotFoundError):
            return f"The model {getattr(exc, 'message', 'requested')} is not available to this key."
        log.warning("Claude API error: %s", exc)
        return "Something went wrong reaching Claude."

    @staticmethod
    def _error_reply(message: str, used: list[str], path: str = "brain") -> Reply:
        return Reply(speech=message, path=path, data={"tools_used": used, "error": True})


def _tool_result(tool_use_id: str, content: str, error: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": content,
    }
    if error:
        result["is_error"] = True
    return result


def _text_of(message: Any) -> str:
    return "".join(block.text for block in message.content if block.type == "text")
