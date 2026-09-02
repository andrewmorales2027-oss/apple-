"""Time and date."""

from __future__ import annotations

import time
from datetime import datetime, timezone as dt_timezone

from jarvis.core.skills import Reply, skill

try:
    from zoneinfo import ZoneInfo, available_timezones
except ImportError:  # pragma: no cover - Python < 3.9
    ZoneInfo = None  # type: ignore[assignment]

    def available_timezones():  # type: ignore[misc]
        return set()


def _resolve_zone(name: str):
    """Turn what a person says ("Tokyo", "new york") into a real zone."""
    if ZoneInfo is None:
        return None
    candidate = name.strip().replace(" ", "_")
    try:
        return ZoneInfo(candidate)
    except Exception:
        pass
    wanted = candidate.lower()
    for zone in sorted(available_timezones()):
        if zone.rsplit("/", 1)[-1].lower() == wanted:
            return ZoneInfo(zone)
    return None


def _spoken_time(moment: datetime) -> str:
    hour = moment.hour % 12 or 12
    suffix = "in the morning" if moment.hour < 12 else (
        "in the afternoon" if moment.hour < 18 else "in the evening"
    )
    minute = f"{moment.minute:02d}"
    return f"{hour}:{minute} {suffix}"


@skill(
    "get_time",
    "Report the current time, optionally in another city or time zone.",
    patterns=[
        r"\b(?:what(?:'s| is)? the (?:current )?time|what time is it|tell me the time)"
        r"(?: (?:in|for) (?P<location>[a-z ]+?))?\s*$",
        r"^(?:the )?time (?:in|for) (?P<location>[a-z ]+?)\s*$",
    ],
    parameters={
        "location": {
            "type": "string",
            "description": "City or IANA time zone, e.g. 'Tokyo' or 'Europe/Paris'. "
            "Omit for local time.",
        }
    },
    examples=["what time is it", "what's the time in Tokyo"],
)
def get_time(location: str | None = None) -> Reply:
    if location:
        zone = _resolve_zone(location)
        if zone is None:
            return Reply(speech=f"I do not know a time zone called {location}.")
        moment = datetime.now(zone)
        place = location.strip().title()
        return Reply(
            speech=f"It is {_spoken_time(moment)} in {place}.",
            data={"iso": moment.isoformat(), "zone": str(zone)},
        )
    moment = datetime.now()
    return Reply(
        speech=f"It is {_spoken_time(moment)}.",
        data={"iso": moment.isoformat(), "zone": time.tzname[0]},
    )


def _ordinal(day: int) -> str:
    if 11 <= day % 100 <= 13:
        return f"{day}th"
    return f"{day}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(day % 10, 'th') }"


@skill(
    "get_date",
    "Report today's date and the day of the week.",
    patterns=[
        r"\b(?:what(?:'s| is)? (?:the )?date|what day is it|what's today|what day is today)\b",
        r"^(?:today's date|the date)$",
    ],
    examples=["what's the date", "what day is it"],
)
def get_date() -> Reply:
    today = datetime.now()
    spoken = today.strftime(f"%A, the {_ordinal(today.day)} of %B %Y")
    return Reply(
        speech=f"It is {spoken}.",
        data={"iso": today.date().isoformat(), "weekday": today.strftime("%A")},
    )
