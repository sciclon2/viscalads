from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from ..repositories.history import champions, competitions, matches, profiles
from .statistics import build_statistics


def web_payload(connection: sqlite3.Connection) -> dict:
    database_games = matches(connection)
    public_games = [{
        "date": g["played_on"], "tournament": g["tournament"],
        "competition": g["competition"], "competitionName": g["competition_name"],
        "team1": g["team1"], "team2": g["team2"],
        "score1": g["score_team1"], "score2": g["score_team2"],
        "outcome": g["outcome"], "quality": g["result_quality"],
        "status": g["coverage_status"], "evidence": g["evidence_summary"],
    } for g in database_games]
    stats = build_statistics(database_games)
    competition_rows = competitions(connection)
    competition_stats = {}
    for competition in competition_rows:
        slug = competition["slug"]
        scoped_games = [game for game in database_games if game["competition"] == slug]
        scoped_stats = build_statistics(scoped_games)
        competition_stats[slug] = {
            **scoped_stats,
            "games": [game for game in public_games if game["competition"] == slug],
            "champions": [item for item in champions(connection) if any(
                game["tournament"] == item["tournament"] for game in scoped_games
            )],
        }
    profile_rows = profiles(connection)
    return {
        "generatedFrom": "data/sciclon2.sqlite3",
        "competitions": competition_rows,
        "competitionStats": competition_stats,
        "games": public_games,
        "players": stats["players"],
        "profiles": [{
            "name": p["name"],
            "primary": p["positions"][0] if p["positions"] else "",
            "alternate": p["positions"][1] if len(p["positions"]) > 1 else "",
            "notes": p["notes"], "active": p["active"], "photo": p["photo"],
            "competitions": p["competitions"],
        } for p in profile_rows],
        "tournaments": stats["tournaments"], "pairs": stats["pairs"],
        "trios": stats["trios"], "champions": champions(connection),
    }


def write_web_payload(connection: sqlite3.Connection, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(web_payload(connection), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def write_snapshot(connection: sqlite3.Connection, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = web_payload(connection)
    payload["aliases"] = [dict(row) for row in connection.execute(
        "SELECT pa.alias, p.canonical_name AS player FROM player_aliases pa "
        "JOIN players p ON p.id=pa.player_id ORDER BY pa.alias COLLATE NOCASE"
    )]
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
