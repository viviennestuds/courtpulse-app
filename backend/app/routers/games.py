"""Game endpoints: scoreboard, box scores, play-by-play, shots."""
from fastapi import APIRouter, HTTPException, Query
from app.services.game_service import (
    get_today_scoreboard,
    get_scoreboard_by_date,
    get_box_score,
    get_play_by_play,
)

router = APIRouter()


@router.get("/scoreboard")
async def scoreboard(date: str | None = Query(None)):
    """Get today's scoreboard or scoreboard for a specific date."""
    if date:
        return await get_scoreboard_by_date(date)
    return await get_today_scoreboard()


@router.get("/recent")
async def recent_games(days: int = Query(3, ge=1, le=7)):
    """Get recent completed games."""
    from app.services.game_service import get_recent_games
    return await get_recent_games(days)


@router.get("/{game_id}/boxscore")
async def box_score(game_id: str):
    """Get full box score for a game."""
    result = await get_box_score(game_id)
    if not result:
        raise HTTPException(status_code=404, detail="Game not found")
    return result


@router.get("/{game_id}/playbyplay")
async def play_by_play(game_id: str):
    """Get parsed play-by-play events and shot chart data."""
    result = await get_play_by_play(game_id)
    if not result:
        raise HTTPException(status_code=404, detail="Play-by-play not found")
    return result


@router.get("/{game_id}/analytics")
async def game_analytics(game_id: str):
    """Get derived analytics: runs, droughts, lineups, metrics."""
    from app.services.analytics_service import compute_game_analytics
    return await compute_game_analytics(game_id)


@router.get("/{game_id}/matchup")
async def matchup_intelligence(game_id: str):
    """Get matchup intelligence for a game."""
    from app.services.matchup_service import compute_matchup
    return await compute_matchup(game_id)
