"""Reaching the outside world: browser launches and a Wikipedia lookup."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

from jarvis.core.skills import Reply, skill

USER_AGENT = "jarvis-assistant/1.0 (https://github.com/topics/jarvis-ai)"
TIMEOUT = 8

# Spoken shorthand for sites people actually name out loud.
KNOWN_SITES = {
    "github": "https://github.com",
    "youtube": "https://youtube.com",
    "google": "https://google.com",
    "gmail": "https://mail.google.com",
    "maps": "https://maps.google.com",
    "wikipedia": "https://wikipedia.org",
    "reddit": "https://reddit.com",
    "hacker news": "https://news.ycombinator.com",
    "stack overflow": "https://stackoverflow.com",
    "amazon": "https://amazon.com",
    "netflix": "https://netflix.com",
    "spotify": "https://open.spotify.com",
    "linkedin": "https://linkedin.com",
    "claude": "https://claude.ai",
}


def _to_url(target: str) -> str:
    key = target.strip().lower().rstrip("/")
    if key in KNOWN_SITES:
        return KNOWN_SITES[key]
    if key.startswith(("http://", "https://")):
        return key
    if "." in key and " " not in key:
        return f"https://{key}"
    return ""


def _launch(url: str, ctx) -> Reply:
    """Open a URL, or hand it back when we are not allowed to or cannot."""
    if not ctx.config.allow_launch:
        return Reply(
            speech="Opening pages is switched off. The link is on screen.",
            display=url,
            data={"url": url, "opened": False},
        )
    try:
        opened = webbrowser.open(url)
    except Exception:
        opened = False
    if not opened:
        # Headless boxes and containers have no browser; saying so beats
        # claiming to have opened something that never appeared.
        return Reply(
            speech="I have no browser to open here, so the link is on screen instead.",
            display=url,
            data={"url": url, "opened": False},
        )
    return Reply(speech="Opening it now.", display=url, data={"url": url, "opened": True})


@skill(
    "open_website",
    "Open a website in the user's browser, by name or by address.",
    patterns=[
        r"\b(?:open|launch|go to|pull up|bring up)(?: up)? (?P<target>[\w. -]+?)"
        r"(?: (?:website|site|page|for me))?\s*$",
    ],
    parameters={
        "target": {
            "type": "string",
            "description": "A site name like 'github' or a domain like 'example.com'.",
        }
    },
    required=["target"],
    examples=["open github"],
)
def open_website(ctx, target: str) -> Reply:
    url = _to_url(target)
    if not url:
        return Reply(speech=f"I do not know a site called {target}.")
    return _launch(url, ctx)


@skill(
    "web_search",
    "Open a web search for a query in the browser.",
    patterns=[
        r"\b(?:search (?:the web|the internet|google|online) for|google|"
        r"look up|search for)\s+(?P<query>.+)",
    ],
    parameters={"query": {"type": "string", "description": "What to search for."}},
    required=["query"],
    examples=["search the web for tide times"],
)
def web_search(ctx, query: str) -> Reply:
    query = query.strip()
    if not query:
        return Reply(speech="What should I search for?")
    url = "https://duckduckgo.com/?q=" + urllib.parse.quote_plus(query)
    reply = _launch(url, ctx)
    if reply.data.get("opened"):
        reply.speech = f"Searching for {query}."
    return reply


@skill(
    "wikipedia_lookup",
    "Look up a short factual summary of a topic on Wikipedia. Good for people, "
    "places, organisations and events.",
    patterns=[
        r"\b(?:who|what) (?:is|was|are|were) (?:a |an |the )?(?P<topic>[\w' -]{3,60})\s*$",
        r"\btell me about (?P<topic>[\w' -]{3,60})\s*$",
        r"\bwikipedia (?:on |for |about )?(?P<topic>[\w' -]{3,60})\s*$",
    ],
    parameters={
        "topic": {"type": "string", "description": "The subject to summarise."}
    },
    required=["topic"],
    # Below 1.0: "who is my dentist" should reach the recall skill first.
    weight=0.9,
    examples=["who is Ada Lovelace", "tell me about the Severn Bridge"],
)
def wikipedia_lookup(topic: str) -> Reply:
    topic = topic.strip()
    if not topic:
        return Reply(speech="What should I look up?")
    slug = urllib.parse.quote(topic.replace(" ", "_"), safe="")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{slug}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return Reply(speech=f"Wikipedia has no article on {topic}.")
        return Reply(speech=f"Wikipedia returned an error, {exc.code}.")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return Reply(speech="I could not reach Wikipedia just now.")

    if payload.get("type", "").endswith("disambiguation"):
        return Reply(speech=f"{topic} is ambiguous on Wikipedia. Can you be more specific?")
    summary = (payload.get("extract") or "").strip()
    if not summary:
        return Reply(speech=f"I found nothing useful on {topic}.")
    # Two sentences is about as much as anyone wants read aloud.
    spoken = " ".join(summary.split(". ")[:2]).strip()
    if not spoken.endswith("."):
        spoken += "."
    return Reply(
        speech=spoken,
        display=summary,
        data={"title": payload.get("title"),
              "url": (payload.get("content_urls") or {}).get("desktop", {}).get("page")},
    )
