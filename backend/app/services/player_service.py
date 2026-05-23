"""Player data retrieval using nba_api."""
import logging
from nba_api.stats.endpoints import leaguedashplayerstats
from app.cache.redis_cache import cache_get, cache_set
from app.config import CACHE_TTL_PLAYER_STATS, NBA_SEASON, NBA_SEASON_TYPE

logger = logging.getLogger(__name__)


async def get_all_players(min_games: int = 10):
    cached = await cache_get(f"players:all:{min_games}")
    if cached:
        return cached

    try:
        stats = leaguedashplayerstats.LeagueDashPlayerStats(
            season=NBA_SEASON,
            season_type_all_star=NBA_SEASON_TYPE,
            measure_type_detailed_defense="Base",
            per_mode_detailed="PerGame",
        )
        df = stats.get_data_frames()[0]
        df = df[df["GP"] >= min_games]

        players = []
        for _, row in df.iterrows():
            fga = float(row.get("FGA", 0))
            fta = float(row.get("FTA", 0))
            pts = float(row.get("PTS", 0))
            ts_pct = (pts / (2 * (fga + 0.44 * fta)) * 100) if fga > 0 else 0

            players.append({
                "id": str(int(row["PLAYER_ID"])),
                "name": row["PLAYER_NAME"],
                "teamId": str(int(row["TEAM_ID"])),
                "teamAbbr": row.get("TEAM_ABBREVIATION", ""),
                "age": int(row.get("AGE", 0)),
                "ppg": round(pts, 1),
                "rpg": round(float(row.get("REB", 0)), 1),
                "apg": round(float(row.get("AST", 0)), 1),
                "spg": round(float(row.get("STL", 0)), 1),
                "bpg": round(float(row.get("BLK", 0)), 1),
                "fgPct": round(float(row.get("FG_PCT", 0)) * 100, 1),
                "threePct": round(float(row.get("FG3_PCT", 0)) * 100, 1),
                "ftPct": round(float(row.get("FT_PCT", 0)) * 100, 1),
                "mpg": round(float(row.get("MIN", 0)), 1),
                "tsPct": round(ts_pct, 1),
            })

        await cache_set(f"players:all:{min_games}", players, ttl=CACHE_TTL_PLAYER_STATS)
        return players
    except Exception as e:
        logger.error(f"Failed to fetch player stats: {e}")
        return []


async def get_player_detail(player_id: str):
    """Placeholder for detailed player view with game logs and shot profile."""
    players = await get_all_players()
    player = next((p for p in players if p["id"] == player_id), None)
    return {"player": player, "gameLogs": [], "shotProfile": []}
