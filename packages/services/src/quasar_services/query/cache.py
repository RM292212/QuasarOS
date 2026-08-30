"""
QuasarOS Query In-Memory LRU Cache.

Provides thread-safe caching of exact point and profile query results
to meet sub-millisecond p95 latency targets.
"""

from collections import OrderedDict
import threading
from typing import Any, Dict, Optional, Tuple


class QueryCache:
    """
    Thread-safe in-memory LRU cache for query results.
    """

    def __init__(self, max_size: int = 5000):
        self.max_size = max_size
        self._cache: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self.hits += 1
                return self._cache[key]
            self.misses += 1
            return None

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._cache[key] = value
            else:
                if len(self._cache) >= self.max_size:
                    self._cache.popitem(last=False)
                self._cache[key] = value

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self.hits = 0
            self.misses = 0

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self.hits + self.misses
            hit_ratio = (self.hits / total) if total > 0 else 0.0
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self.hits,
                "misses": self.misses,
                "hit_ratio": hit_ratio,
            }
