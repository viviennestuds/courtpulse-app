"""Data transformers that convert raw NBA API responses into app-friendly format.

These mirror the TypeScript transformers in the frontend so the API contract
is identical whether data comes from client CDN calls or the backend.
"""
import re
import logging

logger = logging.getLogger(__name__)


def _parse_pt_clock(pt_clock: str | None) -> str:
    if not pt_clock:
        return ""
    match = re.match(r"PT(\d+)M([\d.]+)S", pt_clock)
    if not match:
        return pt_clock.replace("PT", "").replace("M", ":").replace("S", "")
    mins = int(match.group(1))
    secs = int(float(match.group(2)))
    return f"{mins}:{secs:02d}"


def _parse_pt_to_seconds(pt_clock: str | None) -> float:
    if not pt_clock:
        return 0
    match = re.match(r"PT(\d+)M([\d.]+)S", pt_clock)
    if not match:
        return 0
    return int(match.group(1)) * 60 + float(match.group(2))


def _get_game_status(status: int) -> str:
    if status == 1:
        return "scheduled"
    if status == 2:
        return "live"
    return "final"


def _get_period_text(period: int, game_status: int) -> str:
    if game_status == 1:
        return ""
    if game_status == 3:
        if period <= 4:
            return "Final"
        return f"Final/OT{'' if period == 5 else period - 4}"
    if period <= 4:
        return f"Q{period}"
    return f"OT{'' if period == 5 else period - 4}"


def transform_scoreboard(raw: dict) -> dict:
    sb = raw.get("scoreboard", {})
    game_date = sb.get("gameDate", "")
    games = []
    for g in sb.get("games", []):
        games.append({
            "id": g["gameId"],
            "date": game_date,
            "status": _get_game_status(g["gameStatus"]),
            "period": _get_period_text(g.get("period", 0), g["gameStatus"]),
            "clock": g.get("gameStatusText", "").strip() if g["gameStatus"] == 1 else _parse_pt_clock(g.get("gameClock")),
            "homeTeam": {
                "id": str(g["homeTeam"]["teamId"]),
                "abbreviation": g["homeTeam"]["teamTricode"],
                "name": g["homeTeam"]["teamName"],
                "score": g["homeTeam"]["score"],
                "primaryColor": "#64748B",
            },
            "awayTeam": {
                "id": str(g["awayTeam"]["teamId"]),
                "abbreviation": g["awayTeam"]["teamTricode"],
                "name": g["awayTeam"]["teamName"],
                "score": g["awayTeam"]["score"],
                "primaryColor": "#64748B",
            },
            "arena": "",
            "isPlayoff": False,
        })
    return {"games": games, "gameDate": game_date}


def transform_boxscore(raw: dict) -> dict:
    g = raw.get("game", {})
    home = g.get("homeTeam", {})
    away = g.get("awayTeam", {})

    def transform_players(team_data: dict) -> list[dict]:
        players = []
        for p in team_data.get("players", []):
            if p.get("played") != "1" and p.get("status") != "ACTIVE":
                continue
            s = p.get("statistics", {})
            players.append({
                "playerId": str(p["personId"]),
                "name": p.get("nameI", p.get("name", "")),
                "position": p.get("position", ""),
                "minutes": _parse_pt_clock(str(s.get("minutes", "PT0M0S"))),
                "points": s.get("points", 0),
                "rebounds": s.get("reboundsTotal", 0),
                "assists": s.get("assists", 0),
                "steals": s.get("steals", 0),
                "blocks": s.get("blocks", 0),
                "turnovers": s.get("turnovers", 0),
                "fgm": s.get("fieldGoalsMade", 0),
                "fga": s.get("fieldGoalsAttempted", 0),
                "tpm": s.get("threePointersMade", 0),
                "tpa": s.get("threePointersAttempted", 0),
                "ftm": s.get("freeThrowsMade", 0),
                "fta": s.get("freeThrowsAttempted", 0),
                "plusMinus": s.get("plusMinusPoints", 0),
            })
        return sorted(players, key=lambda p: p.get("order", 0) if "order" in p else 0)

    def extract_team_stats(team_data: dict) -> dict:
        s = team_data.get("statistics", {})
        return {
            "points": team_data.get("score", 0),
            "fieldGoalsMade": s.get("fieldGoalsMade", 0),
            "fieldGoalsAttempted": s.get("fieldGoalsAttempted", 0),
            "fieldGoalsPercentage": float(s.get("fieldGoalsPercentage", 0)) * 100,
            "threePointersMade": s.get("threePointersMade", 0),
            "threePointersAttempted": s.get("threePointersAttempted", 0),
            "threePointersPercentage": float(s.get("threePointersPercentage", 0)) * 100,
            "freeThrowsMade": s.get("freeThrowsMade", 0),
            "freeThrowsAttempted": s.get("freeThrowsAttempted", 0),
            "freeThrowsPercentage": float(s.get("freeThrowsPercentage", 0)) * 100,
            "reboundsTotal": s.get("reboundsTotal", 0),
            "assists": s.get("assists", 0),
            "steals": s.get("steals", 0),
            "blocks": s.get("blocks", 0),
            "turnovers": s.get("turnovers", 0),
            "pointsInThePaint": s.get("pointsInThePaint", 0),
            "pointsFastBreak": s.get("pointsFastBreak", 0),
        }

    arena = g.get("arena", {})

    return {
        "game": {
            "id": g.get("gameId", ""),
            "date": "",
            "status": _get_game_status(g.get("gameStatus", 3)),
            "period": _get_period_text(g.get("period", 0), g.get("gameStatus", 3)),
            "clock": _parse_pt_clock(g.get("gameClock")),
            "homeTeam": {
                "id": str(home.get("teamId", "")),
                "abbreviation": home.get("teamTricode", ""),
                "name": home.get("teamName", ""),
                "score": home.get("score", 0),
                "primaryColor": "#64748B",
            },
            "awayTeam": {
                "id": str(away.get("teamId", "")),
                "abbreviation": away.get("teamTricode", ""),
                "name": away.get("teamName", ""),
                "score": away.get("score", 0),
                "primaryColor": "#64748B",
            },
            "arena": arena.get("arenaName", ""),
            "isPlayoff": False,
        },
        "homeBoxScore": transform_players(home),
        "awayBoxScore": transform_players(away),
        "homeTeamStats": extract_team_stats(home),
        "awayTeamStats": extract_team_stats(away),
    }


def transform_pbp(raw: dict) -> dict:
    game_data = raw.get("game", {})
    actions = game_data.get("actions", [])

    events = []
    shots = []

    for i, a in enumerate(actions):
        action_type = (a.get("actionType") or "").lower()
        if action_type in ("period", "game", "jumpball", "stoppage"):
            continue

        shot_result = (a.get("shotResult") or "").lower()
        if action_type in ("2pt", "3pt"):
            event_type = "score" if shot_result == "made" else "miss"
        elif action_type == "freethrow":
            event_type = "score" if shot_result == "made" else "miss"
        elif action_type == "turnover":
            event_type = "turnover"
        elif action_type == "foul":
            event_type = "foul"
        elif action_type == "substitution":
            event_type = "substitution"
        elif action_type == "rebound":
            event_type = "rebound"
        elif action_type == "timeout":
            event_type = "timeout"
        elif action_type == "block":
            event_type = "block"
        elif action_type == "steal":
            event_type = "steal"
        else:
            event_type = "miss"

        home_score = int(a.get("scoreHome") or 0)
        away_score = int(a.get("scoreAway") or 0)
        score_delta = None
        if event_type == "score":
            if action_type == "3pt":
                score_delta = 3
            elif action_type == "2pt":
                score_delta = 2
            elif action_type == "freethrow":
                score_delta = 1

        clock_secs = _parse_pt_to_seconds(a.get("clock"))
        is_clutch = a.get("period", 0) >= 4 and clock_secs <= 300 and abs(home_score - away_score) <= 5

        events.append({
            "id": f"{a.get('period', 0)}-{a.get('actionNumber', i)}-{i}",
            "period": a.get("period", 0),
            "clock": _parse_pt_clock(a.get("clock")),
            "eventType": event_type,
            "description": a.get("description") or f"{a.get('playerNameI', '')} {action_type}".strip(),
            "teamId": str(a.get("teamId", "")),
            "teamAbbr": a.get("teamTricode", ""),
            "playerId": str(a["personId"]) if a.get("personId") else None,
            "playerName": a.get("playerNameI") or a.get("playerName"),
            "homeScore": home_score,
            "awayScore": away_score,
            "scoreDelta": score_delta,
            "isClutch": is_clutch,
        })

        if a.get("isFieldGoal") and action_type != "freethrow":
            x_legacy = a.get("xLegacy")
            y_legacy = a.get("yLegacy")
            x = (x_legacy + 250) / 500 if x_legacy is not None else a.get("x", 0) / 100
            y = y_legacy / 470 if y_legacy is not None else a.get("y", 0) / 100

            shots.append({
                "id": f"shot-{a.get('actionNumber', i)}",
                "playerId": str(a.get("personId", "")),
                "playerName": a.get("playerNameI") or a.get("playerName", ""),
                "teamId": str(a.get("teamId", "")),
                "x": max(0, min(1, x)),
                "y": max(0, min(1, y)),
                "made": shot_result == "made",
                "shotType": "3PT" if action_type == "3pt" else (a.get("subType") or "2PT"),
                "distance": a.get("shotDistance", 0),
                "period": a.get("period", 0),
                "clock": _parse_pt_clock(a.get("clock")),
                "points": 3 if action_type == "3pt" else 2,
            })

    return {"events": events, "shots": shots, "rawActions": actions}
