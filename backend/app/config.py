"""Application configuration from environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_SCOREBOARD = int(os.getenv("CACHE_TTL_SCOREBOARD", "30"))
CACHE_TTL_BOXSCORE = int(os.getenv("CACHE_TTL_BOXSCORE", "60"))
CACHE_TTL_PBP = int(os.getenv("CACHE_TTL_PBP", "60"))
CACHE_TTL_TEAM_STATS = int(os.getenv("CACHE_TTL_TEAM_STATS", "1800"))
CACHE_TTL_PLAYER_STATS = int(os.getenv("CACHE_TTL_PLAYER_STATS", "1800"))
CACHE_TTL_ANALYTICS = int(os.getenv("CACHE_TTL_ANALYTICS", "300"))

NBA_SEASON = os.getenv("NBA_SEASON", "2024-25")
NBA_SEASON_TYPE = os.getenv("NBA_SEASON_TYPE", "Regular Season")

USE_PBPSTATS = os.getenv("USE_PBPSTATS", "false").lower() == "true"
