"""
In-memory session store for detection history.
"""
import random
import string
from datetime import datetime, timezone
from typing import Optional


def _make_session_id() -> str:
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"sess_{ts}_{rand}"


class SessionStore:
    def __init__(self):
        self._store: dict = {}

    def create_session(self, session_type: str) -> str:
        session_id = _make_session_id()
        self._store[session_id] = {
            "session_id": session_id,
            "type": session_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "objects_count": 0,
            "unique_classes": [],
            "thumbnail_url": None,
            "duration_seconds": None,
        }
        return session_id

    def update_session(self, session_id: str, data: dict) -> None:
        if session_id in self._store:
            self._store[session_id].update(data)

    def get_session(self, session_id: str) -> Optional[dict]:
        return self._store.get(session_id)

    def list_sessions(self) -> list:
        return sorted(
            self._store.values(),
            key=lambda s: s["created_at"],
            reverse=True,
        )


# Singleton instance used by app.py
store = SessionStore()
