"""Timers and reminders.

Deliberately thread-based rather than async: the reflex path, the CLI and the
HTTP server are all synchronous, and a countdown does not justify dragging an
event loop through the whole program.
"""

from __future__ import annotations

import itertools
import threading
import time
from dataclasses import dataclass
from typing import Callable


@dataclass
class Alarm:
    id: int
    #: Short name, for listing back to the user.
    label: str
    #: The full sentence announced when it fires.
    message: str
    due: float
    timer: threading.Timer

    @property
    def seconds_left(self) -> float:
        return max(0.0, self.due - time.time())


class Scheduler:
    """Fire a callback after a delay, with cancel and introspection."""

    def __init__(self, on_fire: Callable[[str], None] | None = None) -> None:
        self._alarms: dict[int, Alarm] = {}
        self._ids = itertools.count(1)
        self._lock = threading.RLock()
        self.on_fire: Callable[[str], None] = on_fire or (lambda message: None)

    def schedule(self, seconds: float, label: str, message: str | None = None) -> Alarm:
        if seconds <= 0:
            raise ValueError("delay must be positive")
        alarm_id = next(self._ids)
        timer = threading.Timer(seconds, self._fire, args=(alarm_id,))
        timer.daemon = True  # never hold up interpreter shutdown
        alarm = Alarm(
            id=alarm_id,
            label=label,
            message=message or label,
            due=time.time() + seconds,
            timer=timer,
        )
        with self._lock:
            self._alarms[alarm_id] = alarm
        timer.start()
        return alarm

    def _fire(self, alarm_id: int) -> None:
        with self._lock:
            alarm = self._alarms.pop(alarm_id, None)
        if alarm is None:
            return
        self.on_fire(alarm.message)

    def cancel(self, alarm_id: int) -> Alarm | None:
        with self._lock:
            alarm = self._alarms.pop(alarm_id, None)
        if alarm is not None:
            alarm.timer.cancel()
        return alarm

    def cancel_all(self) -> int:
        with self._lock:
            alarms = list(self._alarms.values())
            self._alarms.clear()
        for alarm in alarms:
            alarm.timer.cancel()
        return len(alarms)

    def pending(self) -> list[Alarm]:
        with self._lock:
            return sorted(self._alarms.values(), key=lambda a: a.due)

    def shutdown(self) -> None:
        self.cancel_all()
