"""
CourtPulse NBA Analytics Backend
FastAPI + nba_api + pbpstats + Redis caching
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import games, teams, players, analytics, feedback

app = FastAPI(
    title="CourtPulse API",
    description="NBA analytics backend powering scoring runs, lineups, threshold splits, and matchup intelligence",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router, prefix="/api/games", tags=["games"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "courtpulse-api"}
