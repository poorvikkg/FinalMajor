"""In-memory conversation session store for multi-turn RAG chat."""

from typing import Dict, List
from collections import defaultdict


class SessionMemory:
    """Holds the conversation history for a single chat session."""

    MAX_TURNS = 20  # Prevent unbounded growth; oldest turns are dropped

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._turns: List[Dict[str, str]] = []

    @property
    def turn_count(self) -> int:
        return len(self._turns)

    def add_turn(self, user: str, assistant: str) -> None:
        """Append a user/assistant exchange, evicting oldest if limit reached."""
        self._turns.append({"user": user, "assistant": assistant})
        if len(self._turns) > self.MAX_TURNS:
            self._turns.pop(0)

    def get_history_text(self, max_turns: int = 5) -> str:
        """
        Return the last N turns as a formatted text block to prepend to the query.
        Using only recent turns keeps the context window manageable.
        """
        recent = self._turns[-max_turns:]
        if not recent:
            return ""
        lines = []
        for turn in recent:
            lines.append(f"User: {turn['user']}")
            lines.append(f"Assistant: {turn['assistant']}")
        return "\n".join(lines)

    def clear(self) -> None:
        self._turns.clear()


# ── Module-level session store ────────────────────────────────────────────────

_sessions: Dict[str, SessionMemory] = {}


def get_session_memory(session_id: str) -> SessionMemory:
    """Return (or create) the SessionMemory for a given session_id."""
    if session_id not in _sessions:
        _sessions[session_id] = SessionMemory(session_id)
    return _sessions[session_id]


def clear_session(session_id: str) -> None:
    """Remove a session from the store entirely."""
    _sessions.pop(session_id, None)


def active_sessions() -> List[str]:
    """Return all currently active session IDs."""
    return list(_sessions.keys())
