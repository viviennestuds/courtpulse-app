"""Player endpoints."""
from fastapi import APIRouter, Query
from app.services.player_service import get_all_players, get_player_detail

router = APIRouter()


@router.get("/")
async def list_players(min_games: int = Query(10)):
    """Get all players with season stats (filtered by minimum games)."""
    return await get_all_players(min_games)


@router.get("/{player_id}")
async def player_detail(player_id: str):
    """Get detailed player info, game logs, and shot profile."""
    return await get_player_detail(player_id)
