"""Conversation history plus a small durable store."""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Iterable


class Memory:
    """Short-term dialogue history and long-term JSON-backed facts.

    Short-term is what gets replayed to Claude; long-term is what survives a
    restart (notes, remembered facts, preferences).  Writes are atomic so a
    crash mid-save cannot leave a truncated state file behind.
    """

    def __init__(self, path: Path | str, history_turns: int = 12) -> None:
        self.path = Path(path).expanduser()
        # One "turn" is a user message plus the reply, hence the doubling.
        self.history: deque[dict[str, Any]] = deque(maxlen=max(history_turns, 1) * 2)
        self._store: dict[str, Any] = {"notes": [], "facts": {}}
        self._lock = threading.RLock()
        self.load()

    # -- dialogue -------------------------------------------------------
    def remember_exchange(self, user: str, assistant_content: Any) -> None:
        """Record one round trip in the form the Messages API expects."""
        self.history.append({"role": "user", "content": user})
        self.history.append({"role": "assistant", "content": assistant_content})

    def transcript(self) -> list[dict[str, Any]]:
        return list(self.history)

    def forget_conversation(self) -> None:
        self.history.clear()

    # -- durable store --------------------------------------------------
    def add_note(self, text: str) -> dict[str, Any]:
        note = {"text": text, "created": time.time()}
        with self._lock:
            self._store.setdefault("notes", []).append(note)
            self.save()
        return note

    def notes(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._store.get("notes", []))

    def clear_notes(self) -> int:
        with self._lock:
            count = len(self._store.get("notes", []))
            self._store["notes"] = []
            self.save()
        return count

    def drop_note(self, index: int) -> dict[str, Any] | None:
        """Remove the 1-based ``index``-th note, as spoken by the user."""
        with self._lock:
            notes = self._store.setdefault("notes", [])
            if not 1 <= index <= len(notes):
                return None
            removed = notes.pop(index - 1)
            self.save()
        return removed

    def set_fact(self, key: str, value: str) -> None:
        with self._lock:
            self._store.setdefault("facts", {})[key.strip().lower()] = value
            self.save()

    def get_fact(self, key: str) -> str | None:
        with self._lock:
            return self._store.get("facts", {}).get(key.strip().lower())

    def facts(self) -> dict[str, str]:
        with self._lock:
            return dict(self._store.get("facts", {}))

    # -- persistence ----------------------------------------------------
    def load(self) -> None:
        if not self.path.is_file():
            return
        try:
            loaded = json.loads(self.path.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            # A corrupt state file must not stop the assistant from booting.
            return
        if isinstance(loaded, dict):
            with self._lock:
                self._store.update(loaded)
                self._store.setdefault("notes", [])
                self._store.setdefault("facts", {})

    def save(self) -> None:
        with self._lock:
            payload = json.dumps(self._store, indent=2, ensure_ascii=False)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        handle = tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=self.path.parent, delete=False, suffix=".tmp"
        )
        try:
            with handle as tmp:
                tmp.write(payload)
                tmp.flush()
                os.fsync(tmp.fileno())
            os.replace(handle.name, self.path)
        except BaseException:
            Path(handle.name).unlink(missing_ok=True)
            raise
