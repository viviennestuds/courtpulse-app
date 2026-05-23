"""Derived analytics: scoring runs, droughts, lineup segments, custom metrics.

This service mirrors the client-side analyticsEngine.ts but runs server-side
with access to richer data sources (pbpstats optional) and caching.
"""
import logging
from app.cache.redis_cache import cache_get, cache_set
from app.config import CACHE_TTL_ANALYTICS, USE_PBPSTATS
from app.services.game_service import get_play_by_play

logger = logging.getLogger(__name__)

RUN_MIN_POINTS = 8
RUN_MIN_NET = 6
RUN_WINDOW_SECONDS = 180
DROUGHT_MIN_SECONDS = 120


def _clock_to_seconds(clock_str: str) -> float:
    """Parse 'M:SS' clock string to seconds."""
    parts = clock_str.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return 0


def _game_time_elapsed(period: int, clock_seconds: float) -> float:
    period_length = 720 if period <= 4 else 300
    base = (period - 1) * (720 if period <= 4 else 300)
    return base + (period_length - clock_seconds)


def detect_scoring_runs(events: list[dict]) -> list[dict]:
    """Detect scoring runs from parsed play-by-play events."""
    scoring = [
        e for e in events
        if e.get("eventType") == "score" and e.get("scoreDelta", 0) > 0
    ]
    if not scoring:
        return []

    teams = set(e["teamAbbr"] for e in scoring if e.get("teamAbbr"))
    runs = []
    run_id = 1

    for team in teams:
        i = 0
        while i < len(scoring):
            best = None
            for start in range(i, len(scoring)):
                team_pts = 0
                opp_pts = 0
                for end in range(start, len(scoring)):
                    se = scoring[end]
                    start_ev = scoring[start]
                    start_time = _game_time_elapsed(start_ev["period"], _clock_to_seconds(start_ev["clock"]))
                    end_time = _game_time_elapsed(se["period"], _clock_to_seconds(se["clock"]))
                    if end_time - start_time > RUN_WINDOW_SECONDS * 2:
                        break
                    if se.get("teamAbbr") == team:
                        team_pts += se.get("scoreDelta", 0)
                    else:
                        opp_pts += se.get("scoreDelta", 0)
                    net = team_pts - opp_pts
                    if team_pts >= RUN_MIN_POINTS and net >= RUN_MIN_NET:
                        if not best or net > (best["teamPts"] - best["oppPts"]):
                            best = {"startIdx": start, "endIdx": end, "teamPts": team_pts, "oppPts": opp_pts}
                if best and best["startIdx"] == start:
                    break

            if best:
                start_ev = scoring[best["startIdx"]]
                end_ev = scoring[best["endIdx"]]
                players_in_run = set()
                for j in range(best["startIdx"], best["endIdx"] + 1):
                    if scoring[j].get("teamAbbr") == team and scoring[j].get("playerName"):
                        players_in_run.add(scoring[j]["playerName"])

                runs.append({
                    "id": f"run-{run_id}",
                    "teamAbbr": team,
                    "teamId": start_ev.get("teamId", ""),
                    "startClock": start_ev["clock"],
                    "endClock": end_ev["clock"],
                    "period": start_ev["period"],
                    "totalPoints": best["teamPts"],
                    "opponentPoints": best["oppPts"],
                    "netPoints": best["teamPts"] - best["oppPts"],
                    "playCount": best["endIdx"] - best["startIdx"] + 1,
                    "players": list(players_in_run),
                    "isDramatic": (best["teamPts"] - best["oppPts"]) >= 10,
                })
                run_id += 1
                i = best["endIdx"] + 1
            else:
                i += 1

    runs.sort(key=lambda r: r["netPoints"], reverse=True)
    return runs


def detect_droughts(events: list[dict]) -> list[dict]:
    """Detect scoring droughts from parsed events."""
    teams = set(e["teamAbbr"] for e in events if e.get("teamAbbr"))
    droughts = []
    drought_id = 1

    for team in teams:
        scoring_plays = [
            e for e in events
            if e.get("eventType") == "score" and e.get("teamAbbr") == team and e.get("scoreDelta", 0) > 0
        ]
        for i in range(len(scoring_plays) - 1):
            current = scoring_plays[i]
            next_play = scoring_plays[i + 1]
            current_time = _game_time_elapsed(current["period"], _clock_to_seconds(current["clock"]))
            next_time = _game_time_elapsed(next_play["period"], _clock_to_seconds(next_play["clock"]))
            gap = next_time - current_time
            if gap >= DROUGHT_MIN_SECONDS:
                droughts.append({
                    "id": f"drought-{drought_id}",
                    "teamAbbr": team,
                    "teamId": current.get("teamId", ""),
                    "startClock": current["clock"],
                    "endClock": next_play["clock"],
                    "period": current["period"],
                    "duration": f"{int(gap // 60)}:{int(gap % 60):02d}",
                    "opponentPoints": 0,
                })
                drought_id += 1

    return droughts


async def compute_game_analytics(game_id: str) -> dict:
    cache_key = f"analytics:{game_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    pbp_data = await get_play_by_play(game_id)
    events = pbp_data.get("events", [])

    runs = detect_scoring_runs(events)
    droughts = detect_droughts(events)

    result = {
        "runs": runs,
        "droughts": droughts,
        "lineups": [],
        "metrics": [],
    }

    await cache_set(cache_key, result, ttl=CACHE_TTL_ANALYTICS)
    return result
