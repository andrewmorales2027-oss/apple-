"""Countdown timers and short-fuse reminders."""

from __future__ import annotations

from jarvis.core.skills import NUMBER_WORD_PATTERN, Reply, skill

_UNIT_SECONDS = {"s": 1, "sec": 1, "secs": 1, "second": 1, "seconds": 1,
                 "m": 60, "min": 60, "mins": 60, "minute": 60, "minutes": 60,
                 "h": 3600, "hr": 3600, "hrs": 3600, "hour": 3600, "hours": 3600}
_UNIT_PATTERN = r"s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?"
# Digits, or a spoken number like "ten" / "twenty five".
_AMOUNT = r"\d+(?:\.\d+)?|(?:" + NUMBER_WORD_PATTERN + r")(?:[ -](?:" + NUMBER_WORD_PATTERN + r"))?"
# Twenty-four hours: past that it is a calendar entry, not a kitchen timer.
_MAX_SECONDS = 24 * 3600


def _humanise(seconds: float) -> str:
    seconds = int(round(seconds))
    if seconds < 60:
        return f"{seconds} second{'s' if seconds != 1 else ''}"
    if seconds < 3600:
        minutes, rest = divmod(seconds, 60)
        spoken = f"{minutes} minute{'s' if minutes != 1 else ''}"
        return f"{spoken} and {rest} seconds" if rest else spoken
    hours, rest = divmod(seconds, 3600)
    minutes = rest // 60
    spoken = f"{hours} hour{'s' if hours != 1 else ''}"
    return f"{spoken} and {minutes} minutes" if minutes else spoken


@skill(
    "set_timer",
    "Start a countdown timer or a short reminder. Announces itself when it "
    "elapses. Use for anything up to twenty-four hours away.",
    patterns=[
        r"\b(?:set|start|put on)(?: a| an)? (?:timer|alarm) for "
        r"(?P<duration>" + _AMOUNT + r") ?(?P<unit>" + _UNIT_PATTERN + r")\b"
        r"(?: (?:for|to|called|labell?ed) (?P<label>.+))?",
        r"\bremind me (?:to|about) (?P<label>.+?) in "
        r"(?P<duration>" + _AMOUNT + r") ?(?P<unit>" + _UNIT_PATTERN + r")\b",
        r"\bremind me in (?P<duration>" + _AMOUNT + r") ?(?P<unit>" + _UNIT_PATTERN
        + r")\b(?: to (?P<label>.+))?",
    ],
    parameters={
        "duration": {"type": "number", "description": "How long to wait."},
        "unit": {
            "type": "string",
            "description": "Unit of the duration: seconds, minutes or hours.",
            "enum": ["seconds", "minutes", "hours"],
        },
        "label": {
            "type": "string",
            "description": "What the timer is for, announced when it fires.",
        },
    },
    required=["duration", "unit"],
    examples=["set a timer for 5 minutes", "remind me to stretch in 20 minutes"],
)
def set_timer(ctx, duration: float, unit: str = "minutes", label: str | None = None) -> Reply:
    seconds = duration * _UNIT_SECONDS.get(unit.strip().lower(), 60)
    if seconds <= 0:
        return Reply(speech="A timer needs a positive duration.")
    if seconds > _MAX_SECONDS:
        return Reply(speech="I only run timers up to twenty-four hours.")

    label = (label or "").strip() or "Timer"
    spoken_length = _humanise(seconds)
    announcement = (
        f"Your {spoken_length} timer has finished."
        if label == "Timer"
        else f"Reminder: {label}."
    )
    alarm = ctx.scheduler.schedule(seconds, label, announcement)
    detail = f" for {label.lower()}" if label != "Timer" else ""
    return Reply(
        speech=f"Timer set{detail}. {spoken_length.capitalize()}, starting now.",
        data={"timer_id": alarm.id, "seconds": seconds, "label": label},
    )


@skill(
    "list_timers",
    "List the timers currently running and how long each has left.",
    patterns=[
        r"\b(?:what|which|list|show|how many)\b.*\btimers?\b",
        r"\btimers?\b.*\b(?:left|remaining|running|active)\b",
    ],
    examples=["what timers are running"],
)
def list_timers(ctx) -> Reply:
    pending = ctx.scheduler.pending()
    if not pending:
        return Reply(speech="No timers running.")
    parts = [f"{a.label}, {_humanise(a.seconds_left)} left" for a in pending]
    joined = "; ".join(parts)
    count = f"{len(pending)} timer{'s' if len(pending) != 1 else ''}"
    return Reply(
        speech=f"{count}: {joined}.",
        data={"timers": [{"id": a.id, "label": a.label, "left": a.seconds_left}
                         for a in pending]},
    )


@skill(
    "cancel_timers",
    "Cancel a running timer by its id, or every timer at once.",
    patterns=[
        r"\b(?:cancel|stop|clear|kill)\b.*\b(?:all )?(?:the )?timers?\b(?: (?P<timer_id>\d+))?",
    ],
    parameters={
        "timer_id": {
            "type": "integer",
            "description": "Id of one timer to cancel. Omit to cancel all of them.",
        }
    },
    examples=["cancel all timers"],
)
def cancel_timers(ctx, timer_id: int | None = None) -> Reply:
    if timer_id is not None:
        alarm = ctx.scheduler.cancel(timer_id)
        if alarm is None:
            return Reply(speech=f"There is no timer {timer_id}.")
        return Reply(speech="Cancelled.", data={"cancelled": [timer_id]})
    count = ctx.scheduler.cancel_all()
    if not count:
        return Reply(speech="There were no timers to cancel.")
    return Reply(
        speech=f"Cancelled {count} timer{'s' if count != 1 else ''}.",
        data={"cancelled_count": count},
    )
