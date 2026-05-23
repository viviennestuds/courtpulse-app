"""Team data retrieval using nba_api."""
import logging
from nba_api.stats.endpoints import leaguedashteamstats
from app.cache.redis_cache import cache_get, cache_set
from app.config import CACHE_TTL_TEAM_STATS, NBA_SEASON, NBA_SEASON_TYPE

logger = logging.getLogger(__name__)


async def get_all_teams():
    cached = await cache_get("teams:all")
    if cached:
        return cached

    try:
        stats = leaguedashteamstats.LeagueDashTeamStats(
            season=NBA_SEASON,
            season_type_all_star=NBA_SEASON_TYPE,
            measure_type_detailed_defense="Base",
            per_mode_detailed="PerGame",
        )
        df = stats.get_data_frames()[0]
        teams = []
        for _, row in df.iterrows():
            teams.append({
                "id": str(int(row["TEAM_ID"])),
                "name": row["TEAM_NAME"],
                "abbreviation": row.get("TEAM_ABBREVIATION", ""),
                "wins": int(row.get("W", 0)),
                "losses": int(row.get("L", 0)),
                "offRating": float(row.get("OFF_RATING", 0)),
                "defRating": float(row.get("DEF_RATING", 0)),
                "netRating": float(row.get("NET_RATING", 0)),
                "pace": float(row.get("PACE", 0)),
            })
        await cache_set("teams:all", teams, ttl=CACHE_TTL_TEAM_STATS)
        return teams
    except Exception as e:
        logger.error(f"Failed to fetch team stats: {e}")
        return []


async def get_team_detail(team_id: str):
    """Placeholder for detailed team view with game logs and splits."""
    teams = await get_all_teams()
    team = next((t for t in teams if t["id"] == team_id), None)
    return {"team": team, "gameLogs": [], "splits": []}
