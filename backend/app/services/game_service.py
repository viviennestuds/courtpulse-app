"""Game data retrieval using nba_api and CDN endpoints."""
import logging
from datetime import datetime, timedelta

from app.cache.redis_cache import cache_get, cache_set
from app.config import CACHE_TTL_SCOREBOARD, CACHE_TTL_BOXSCORE, CACHE_TTL_PBP
from app.utils.nba_client import fetch_cdn_json, fetch_stats_endpoint
from app.utils.transformers import transform_scoreboard, transform_boxscore, transform_pbp

logger = logging.getLogger(__name__)


async def get_today_scoreboard():
    cached = await cache_get("scoreboard:today")
    if cached:
        return cached

    raw = await fetch_cdn_json("scoreboard/todaysScoreboard_00.json")
    result = transform_scoreboard(raw)
    await cache_set("scoreboard:today", result, ttl=CACHE_TTL_SCOREBOARD)
    return result


async def get_scoreboard_by_date(date: str):
    cache_key = f"scoreboard:{date}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    raw = await fetch_stats_endpoint("scoreboardv3", {"LeagueID": "00", "GameDate": date})
    result = transform_scoreboard(raw)
    await cache_set(cache_key, result, ttl=CACHE_TTL_SCOREBOARD * 10)
    return result


async def get_recent_games(days: int = 3):
    all_games = []
    today = datetime.now()
    for i in range(1, days + 1):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            sb = await get_scoreboard_by_date(date)
            all_games.extend(sb.get("games", []))
        except Exception as e:
            logger.warning(f"Failed to fetch games for {date}: {e}")
    return all_games


async def get_box_score(game_id: str):
    cache_key = f"boxscore:{game_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    raw = await fetch_cdn_json(f"boxscore/boxscore_{game_id}.json")
    result = transform_boxscore(raw)
    await cache_set(cache_key, result, ttl=CACHE_TTL_BOXSCORE)
    return result


async def get_play_by_play(game_id: str):
    cache_key = f"pbp:{game_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    raw = await fetch_cdn_json(f"playbyplay/playbyplay_{game_id}.json")
    result = transform_pbp(raw)
    await cache_set(cache_key, result, ttl=CACHE_TTL_PBP)
    return result
