"""In-memory LRU cache for RAG query results."""

import hashlib
import json
from collections import OrderedDict
from typing import Any, Dict, Optional


class QueryCache:
    """
    Thread-safe, size-bounded LRU cache for RAG responses.
    Keys are MD5 hashes of the normalised query string.
    Prevents duplicate Groq API calls for identical queries.
    """

    def __init__(self, max_size: int = 200):
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._max_size = max_size

    @staticmethod
    def _make_key(query: str) -> str:
        """Normalise and hash the query to produce a cache key."""
        normalised = query.strip().lower()
        return hashlib.md5(normalised.encode()).hexdigest()

    def get(self, query: str) -> Optional[Dict[str, Any]]:
        """Return the cached result for a query, or None if not cached."""
        key = self._make_key(query)
        if key in self._cache:
            # Move to end to mark as recently used
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def set(self, query: str, result: Dict[str, Any]) -> None:
        """Store a result in the cache, evicting the LRU entry if full."""
        key = self._make_key(query)
        self._cache[key] = result
        self._cache.move_to_end(key)
        if len(self._cache) > self._max_size:
            self._cache.popitem(last=False)  # Evict least recently used

    def invalidate(self, query: str) -> None:
        """Remove a specific query from the cache."""
        key = self._make_key(query)
        self._cache.pop(key, None)

    def clear(self) -> None:
        """Flush the entire cache."""
        self._cache.clear()

    def __len__(self) -> int:
        return len(self._cache)


# Module-level singleton cache
_query_cache = QueryCache(max_size=200)


def get_cache() -> QueryCache:
    return _query_cache
