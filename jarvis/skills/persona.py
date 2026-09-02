"""Conversational glue: greetings, identity, help, resets.

Most of these are hidden from the brain (``exposed_to_brain=False``): if Claude
is already answering, it should say hello in its own words rather than call a
tool to do it.  ``list_skills`` is the exception - the model genuinely needs a
way to find out what it can do.
"""

from __future__ import annotations

from datetime import datetime

from jarvis.core.skills import Reply, skill


@skill(
    "greet",
    "Return a greeting.",
    patterns=[
        r"^(?:hello|hi|hey|yo|good (?:morning|afternoon|evening)|"
        r"are you (?:there|awake|online|up))\b",
        r"^(?:you (?:there|up|awake)|wake up)\b",
        # Bare wake word: the user has our attention but has not asked yet.
        r"^(?:hey |hi |ok |okay |yo |hello )?jarvis$",
    ],
    exposed_to_brain=False,
    examples=["hello"],
)
def greet(ctx) -> Reply:
    hour = datetime.now().hour
    part = "morning" if hour < 12 else ("afternoon" if hour < 18 else "evening")
    return Reply(speech=f"Good {part}, {ctx.address}. What can I do for you?")


@skill(
    "identify",
    "Explain what this assistant is.",
    patterns=[
        r"^(?:who|what) are you\b",
        r"\bwhat(?:'s| is) your name\b",
        r"\bintroduce yourself\b",
    ],
    exposed_to_brain=False,
    examples=["who are you"],
)
def identify(ctx) -> Reply:
    name = ctx.config.name
    skills = len(ctx.registry or [])
    if ctx.brain_ready():
        return Reply(
            speech=f"I am {name}. I have {skills} skills for the routine things "
            "and Claude behind me for the rest."
        )
    return Reply(
        speech=f"I am {name}, running {skills} local skills. The reasoning path "
        "is offline, so anything my skills do not cover, I will say so."
    )


@skill(
    "list_skills",
    "List what this assistant can do. Call this when the user asks about your "
    "capabilities, or when you are unsure whether a skill exists.",
    patterns=[
        r"\bwhat can you do\b",
        r"^(?:help|commands|skills|capabilities)$",
        r"\b(?:list|show me) (?:your )?(?:skills|commands|capabilities|abilities)\b",
    ],
    examples=["what can you do"],
)
def list_skills(ctx) -> Reply:
    entries = list(ctx.registry or [])
    named = [e for e in entries if e.examples]
    spoken = ", ".join(e.name.replace("_", " ") for e in entries[:8])
    lines = [f"{e.name}: {e.description}" for e in entries]
    if named:
        lines.append("")
        lines.append("Try: " + "; ".join(f'"{e.examples[0]}"' for e in named[:6]))
    return Reply(
        speech=f"I have {len(entries)} skills, including {spoken}. "
        "The full list is on screen.",
        display="\n".join(lines),
        data={"skills": [e.name for e in entries]},
    )


@skill(
    "thanks",
    "Acknowledge thanks.",
    patterns=[r"^(?:thanks|thank you|cheers|nice one|much appreciated|ta)\b"],
    exposed_to_brain=False,
    examples=["thank you"],
)
def thanks(ctx) -> Reply:
    return Reply(speech=f"Any time, {ctx.address}.")


@skill(
    "reset_conversation",
    "Clear the running conversation history without touching saved notes.",
    patterns=[
        r"\b(?:forget (?:this|our) conversation|start over|clear (?:the )?(?:context|history)|"
        r"new conversation|reset yourself)\b",
    ],
    examples=["forget this conversation"],
)
def reset_conversation(ctx) -> Reply:
    ctx.memory.forget_conversation()
    return Reply(speech="Context cleared. Your notes are untouched.")
