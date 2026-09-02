"""Notes and remembered facts - the parts that survive a restart."""

from __future__ import annotations

from jarvis.core.skills import Reply, skill


@skill(
    "add_note",
    "Save a note for the user to read back later.",
    patterns=[
        r"\b(?:make|take|add|write|jot down)(?: me)?(?: a| an)? note(?: that| saying| about)? "
        r"(?P<text>.+)",
        r"\bnote (?:that|down) (?P<text>.+)",
        r"\badd (?P<text>.+?) to (?:my )?(?:notes|note list)\b",
    ],
    parameters={"text": {"type": "string", "description": "The note's content."}},
    required=["text"],
    examples=["note that the spare key is under the mat"],
)
def add_note(ctx, text: str) -> Reply:
    text = text.strip().rstrip(".")
    if not text:
        return Reply(speech="There was nothing to write down.")
    ctx.memory.add_note(text)
    total = len(ctx.memory.notes())
    return Reply(speech=f"Noted. That is {total} note{'s' if total != 1 else ''}.",
                 data={"note": text, "total": total})


@skill(
    "list_notes",
    "Read back every saved note.",
    patterns=[
        r"\b(?:what are|read|list|show me|go through)\b.*\bnotes\b",
        r"^(?:my )?notes$",
    ],
    examples=["read my notes"],
)
def list_notes(ctx) -> Reply:
    notes = ctx.memory.notes()
    if not notes:
        return Reply(speech="You have no notes.")
    spoken = ". ".join(f"{i}. {n['text']}" for i, n in enumerate(notes, 1))
    return Reply(
        speech=f"You have {len(notes)} note{'s' if len(notes) != 1 else ''}. {spoken}.",
        data={"notes": [n["text"] for n in notes]},
    )


@skill(
    "delete_note",
    "Delete one note by its position in the list, counting from one.",
    patterns=[r"\b(?:delete|remove|drop|scratch) note (?:number )?(?P<index>\d+)"],
    parameters={"index": {"type": "integer", "description": "1-based position of the note."}},
    required=["index"],
    examples=["delete note 2"],
)
def delete_note(ctx, index: int) -> Reply:
    removed = ctx.memory.drop_note(index)
    if removed is None:
        return Reply(speech=f"There is no note {index}.")
    return Reply(speech=f"Deleted: {removed['text']}.", data={"deleted": removed["text"]})


@skill(
    "clear_notes",
    "Delete every saved note at once.",
    patterns=[r"\b(?:clear|delete|wipe|forget)(?: all)?(?: of)? (?:my |the )?notes\b"],
    examples=["clear my notes"],
)
def clear_notes(ctx) -> Reply:
    count = ctx.memory.clear_notes()
    if not count:
        return Reply(speech="There were no notes to clear.")
    return Reply(speech=f"Cleared {count} note{'s' if count != 1 else ''}.",
                 data={"cleared": count})


@skill(
    "remember",
    "Store a fact about the user under a key, so it survives a restart. Use "
    "this whenever the user asks you to remember something.",
    patterns=[
        r"\bremember (?:that )?(?:my |the )?(?P<key>[\w' ]{2,40}?) (?:is|are|equals) (?P<value>.+)",
    ],
    parameters={
        "key": {"type": "string", "description": "What the fact is about, e.g. 'wifi password'."},
        "value": {"type": "string", "description": "The value to store."},
    },
    required=["key", "value"],
    examples=["remember that my car is a blue Civic"],
)
def remember(ctx, key: str, value: str) -> Reply:
    key = key.strip()
    value = value.strip().rstrip(".")
    if not key or not value:
        return Reply(speech="I need both a subject and a value to remember it.")
    ctx.memory.set_fact(key, value)
    return Reply(speech=f"Noted. Your {key} is {value}.", data={"key": key, "value": value})


@skill(
    "recall",
    "Look up a fact previously stored with the remember skill.",
    patterns=[
        r"\bwhat(?:'s| is| was)? my (?P<key>[\w' ]{2,40})",
        r"\bdo you remember (?:my |the )?(?P<key>[\w' ]{2,40})",
    ],
    parameters={"key": {"type": "string", "description": "What to look up."}},
    required=["key"],
    examples=["what's my car"],
)
def recall(ctx, key: str) -> Reply:
    key = key.strip()
    value = ctx.memory.get_fact(key)
    if value is None:
        known = ", ".join(sorted(ctx.memory.facts())) or "nothing yet"
        return Reply(
            speech=f"I have not been told your {key}. I do know: {known}.",
            data={"known": sorted(ctx.memory.facts())},
        )
    return Reply(speech=f"Your {key} is {value}.", data={"key": key, "value": value})
