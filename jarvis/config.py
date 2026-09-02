"""Configuration: sane defaults, overridable by file then environment."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Any

try:  # Python 3.11+
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - 3.10 and older
    tomllib = None  # type: ignore[assignment]

DEFAULT_CONFIG_NAME = "jarvis.toml"


@dataclass
class Config:
    """Everything tunable, in one place."""

    # Persona
    name: str = "JARVIS"
    address_user_as: str = "sir"
    wake_word: str = "jarvis"

    # Reasoning path
    model: str = "claude-opus-5"
    effort: str = "medium"
    max_tokens: int = 4096
    #: None means "decide at runtime": on when the SDK and credentials exist.
    brain_enabled: bool | None = None
    #: Hard ceiling on tool-call rounds, so a confused turn cannot bill forever.
    max_tool_rounds: int = 6

    # Reflex path
    reflex_threshold: float = 0.55

    # Memory
    data_dir: Path = field(default_factory=lambda: Path.home() / ".jarvis")
    history_turns: int = 12

    # Voice (native mode; the browser HUD uses the Web Speech API instead)
    speech_rate: int = 190
    voice_id: str | None = None
    mute: bool = False

    # Server
    host: str = "127.0.0.1"
    port: int = 7717

    #: Guards skills that reach outside the process (opening a browser).
    allow_launch: bool = True

    def __post_init__(self) -> None:
        self.data_dir = Path(self.data_dir).expanduser()

    @property
    def state_file(self) -> Path:
        return self.data_dir / "state.json"

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["data_dir"] = str(self.data_dir)
        return payload


def _coerce(raw: Any, annotation: Any) -> Any:
    """Best-effort string -> field type, for env vars and TOML."""
    if annotation is bool or annotation == "bool" or annotation == "bool | None":
        if isinstance(raw, bool):
            return raw
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}
    if annotation is int or annotation == "int":
        return int(raw)
    if annotation is float or annotation == "float":
        return float(raw)
    if "Path" in str(annotation):
        return Path(str(raw)).expanduser()
    return raw


def load_config(path: str | Path | None = None, **overrides: Any) -> Config:
    """Build a Config from defaults, then ``jarvis.toml``, then ``JARVIS_*``.

    Later sources win.  Environment keys are the field name upper-cased with a
    ``JARVIS_`` prefix, e.g. ``JARVIS_MODEL=claude-sonnet-5``.
    """
    values: dict[str, Any] = {}
    known = {f.name: f.type for f in fields(Config)}

    candidate = Path(path) if path else Path.cwd() / DEFAULT_CONFIG_NAME
    if candidate.is_file() and tomllib is not None:
        with candidate.open("rb") as handle:
            loaded = tomllib.load(handle)
        for key, value in (loaded.get("jarvis") or loaded).items():
            if key in known:
                values[key] = _coerce(value, known[key])
    elif path and not candidate.is_file():
        raise FileNotFoundError(f"config file not found: {candidate}")

    for key, annotation in known.items():
        env = os.environ.get(f"JARVIS_{key.upper()}")
        if env is not None and env != "":
            values[key] = _coerce(env, annotation)

    values.update(overrides)
    return Config(**values)
