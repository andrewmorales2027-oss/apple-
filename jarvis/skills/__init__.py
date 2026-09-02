"""Builtin skills.

Importing this package registers every builtin.  Third-party skills need only
import :func:`jarvis.skill` and decorate a function - registration is by import,
so dropping a module in here (or importing your own anywhere before the
assistant starts) is all it takes.
"""

from jarvis.skills import calc, clock, notes, persona, system, timers, web  # noqa: F401

__all__ = ["calc", "clock", "notes", "persona", "system", "timers", "web"]
