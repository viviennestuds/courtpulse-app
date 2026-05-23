"""Matchup intelligence: team vs team, contextual matchups, player pairings."""
import logging

logger = logging.getLogger(__name__)


async def compute_matchup(game_id: str) -> dict:
    """
    Compute matchup intelligence for a game.
    
    This is a placeholder that will be expanded to:
    - Pull team season stats for both teams
    - Compute offense-vs-defense contextual edges
    - Pair top players by position/minutes
    - Overlay run analytics on player matchups
    """
    return {
        "gameId": game_id,
        "status": "not_implemented",
        "message": "Matchup intelligence requires team and player season data. Coming soon.",
    }
