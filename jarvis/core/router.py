"""Pick the skill that best explains an utterance."""

from __future__ import annotations

from jarvis.core.skills import Match, Registry, normalize


class Router:
    """The reflex path.

    Every skill scores the utterance and the best score wins, provided it
    clears ``threshold``.  Below that we would rather hand the sentence to the
    brain than guess: a confidently wrong skill is worse than a thoughtful
    answer, and much worse than an honest "I did not catch that".
    """

    def __init__(self, registry: Registry, threshold: float = 0.55) -> None:
        self.registry = registry
        self.threshold = threshold

    def route(self, text: str) -> Match | None:
        best = self.best_match(text)
        if best is None or best.score < self.threshold:
            return None
        return best

    def best_match(self, text: str) -> Match | None:
        """Highest-scoring match regardless of threshold (useful for tuning)."""
        cleaned = normalize(text)
        if not cleaned:
            return None
        best: Match | None = None
        for entry in self.registry:
            match = entry.match(cleaned)
            if match is not None and (best is None or match.score > best.score):
                best = match
        return best

    def rank(self, text: str) -> list[Match]:
        """All matches, best first. Exposed by ``jarvis explain`` for debugging."""
        cleaned = normalize(text)
        matches = [m for m in (s.match(cleaned) for s in self.registry) if m]
        return sorted(matches, key=lambda m: m.score, reverse=True)
