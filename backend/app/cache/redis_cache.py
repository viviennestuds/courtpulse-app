"""Redis caching layer with fallback to in-memory dict."""
import logging
import json
from typing import Any

logger = logging.getLogger(__name__)

_memory_cache: dict[str, Any] = {}
_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        from app.config import REDIS_URL
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        _redis_client.ping()
        logger.info("Connected to Redis")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis unavailable, using in-memory cache: {e}")
        _redis_client = False
        return None


async def cache_get(key: str) -> Any | None:
    r = _get_redis()
    if r:
        try:
            val = r.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis GET failed for {key}: {e}")
    return _memory_cache.get(key)


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    r = _get_redis()
    if r:
        try:
            r.setex(key, ttl, json.dumps(value))
            return
        except Exception as e:
            logger.warning(f"Redis SET failed for {key}: {e}")
    _memory_cache[key] = value
