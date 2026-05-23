"""Team endpoints."""
from fastapi import APIRouter
from app.services.team_service import get_all_teams, get_team_detail

router = APIRouter()


@router.get("/")
async def list_teams():
    """Get all teams with season stats."""
    return await get_all_teams()


@router.get("/{team_id}")
async def team_detail(team_id: str):
    """Get detailed team info, game logs, and splits."""
    return await get_team_detail(team_id)
