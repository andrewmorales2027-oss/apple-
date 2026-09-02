"""Native speech in and out.

Everything here is optional.  The browser HUD gets speech from the Web Speech
API with nothing to install, so this module exists for people who want JARVIS
in a terminal with a microphone.  Each backend is probed at construction and
the assistant stays fully usable when none of them is present - the single
biggest reason the projects on the jarvis-ai topic fail on first run is a hard
dependency on PyAudio.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from typing import Any

log = logging.getLogger("jarvis.voice")


class Speaker:
    """Text to speech, with three fallbacks and a silent last resort."""

    def __init__(self, rate: int = 190, voice_id: str | None = None, mute: bool = False) -> None:
        self.rate = rate
        self.voice_id = voice_id
        self.mute = mute
        self._engine: Any | None = None
        self.backend = "none" if mute else self._pick_backend()

    def _pick_backend(self) -> str:
        try:
            import pyttsx3

            self._engine = pyttsx3.init()
            self._engine.setProperty("rate", self.rate)
            if self.voice_id:
                self._engine.setProperty("voice", self.voice_id)
            return "pyttsx3"
        except Exception as exc:  # noqa: BLE001 - any failure means "try the next one"
            log.debug("pyttsx3 unavailable: %s", exc)
        for command in ("say", "spd-say", "espeak"):
            if shutil.which(command):
                return command
        return "none"

    @property
    def available(self) -> bool:
        return self.backend != "none"

    def say(self, text: str) -> None:
        """Speak ``text``. Never raises - losing audio must not end the session."""
        if not text or self.backend == "none":
            return
        try:
            if self.backend == "pyttsx3" and self._engine is not None:
                self._engine.say(text)
                self._engine.runAndWait()
            elif self.backend == "say":
                subprocess.run(["say", "-r", str(self.rate), text], check=False, timeout=60)
            elif self.backend == "spd-say":
                subprocess.run(["spd-say", "--wait", text], check=False, timeout=60)
            elif self.backend == "espeak":
                subprocess.run(["espeak", "-s", str(self.rate), text], check=False, timeout=60)
        except Exception as exc:  # noqa: BLE001
            log.warning("speech failed (%s): %s", self.backend, exc)

    def voices(self) -> list[dict[str, str]]:
        if self.backend != "pyttsx3" or self._engine is None:
            return []
        return [
            {"id": v.id, "name": getattr(v, "name", v.id)}
            for v in self._engine.getProperty("voices")
        ]


class Ears:
    """Speech to text through ``speech_recognition``, if it is installed."""

    def __init__(self, wake_word: str = "jarvis") -> None:
        self.wake_word = wake_word.lower()
        self._recognizer: Any | None = None
        self._microphone: Any | None = None
        self.error: str | None = None
        self._setup()

    def _setup(self) -> None:
        try:
            import speech_recognition as sr
        except ImportError:
            self.error = (
                "speech recognition is not installed - "
                "run `pip install 'jarvis-assistant[voice]'`"
            )
            return
        try:
            self._recognizer = sr.Recognizer()
            self._microphone = sr.Microphone()
            with self._microphone as source:
                self._recognizer.adjust_for_ambient_noise(source, duration=0.6)
        except Exception as exc:  # noqa: BLE001 - typically "no default input device"
            self.error = f"no usable microphone: {exc}"
            self._recognizer = self._microphone = None

    @property
    def available(self) -> bool:
        return self._recognizer is not None and self._microphone is not None

    def listen(self, timeout: float = 6.0, phrase_limit: float = 12.0) -> str | None:
        """Block until a phrase is heard; return the transcript or None."""
        if not self.available:
            return None
        import speech_recognition as sr

        try:
            with self._microphone as source:  # type: ignore[union-attr]
                audio = self._recognizer.listen(  # type: ignore[union-attr]
                    source, timeout=timeout, phrase_time_limit=phrase_limit
                )
        except Exception:  # sr.WaitTimeoutError and friends
            return None
        try:
            return self._recognizer.recognize_google(audio)  # type: ignore[union-attr]
        except sr.UnknownValueError:
            return None
        except sr.RequestError as exc:
            log.warning("transcription failed: %s", exc)
            return None

    def strip_wake_word(self, text: str) -> tuple[bool, str]:
        """Was the wake word said, and what followed it?"""
        lowered = text.lower().strip()
        index = lowered.find(self.wake_word)
        if index == -1:
            return False, text.strip()
        return True, text[index + len(self.wake_word):].strip(" ,.!?")
