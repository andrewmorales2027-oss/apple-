"""JARVIS - a voice assistant with a reflex path and a reasoning path.

The public surface is deliberately small::

    from jarvis import Assistant, load_config

    jarvis = Assistant(load_config())
    print(jarvis.ask("what time is it").speech)
"""

from jarvis.config import Config, load_config
from jarvis.core.assistant import Assistant
from jarvis.core.skills import Reply, Skill, registry, skill

__version__ = "1.0.0"

__all__ = [
    "Assistant",
    "Config",
    "Reply",
    "Skill",
    "load_config",
    "registry",
    "skill",
]
