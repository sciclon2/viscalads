from __future__ import annotations

import sqlite3

from ..repositories.history import matches
from .statistics import build_statistics


def audit(connection: sqlite3.Connection, expected_matches: int | None = None) -> list[str]:
    errors: list[str] = []
    games = matches(connection)
    if expected_matches is not None and len(games) != expected_matches:
        errors.append(f"expected {expected_matches} matches, found {len(games)}")
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        errors.append(f"SQLite integrity check: {integrity}")
    foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
    if foreign_keys:
        errors.append(f"foreign key violations: {len(foreign_keys)}")
    for game in games:
        label = f"match {game['id']} ({game['played_on']})"
        if len(game["team1"]) != len(set(game["team1"])) or len(game["team2"]) != len(set(game["team2"])):
            errors.append(f"{label}: duplicate player")
        overlap = set(game["team1"]) & set(game["team2"])
        if overlap:
            errors.append(f"{label}: players on both teams: {sorted(overlap)}")
        if game["coverage_status"] == "verified" and (not game["team1"] or not game["team2"] or game["outcome"] == "?"):
            errors.append(f"{label}: verified match is incomplete")
        scores = (game["score_team1"], game["score_team2"])
        if (scores[0] is None) != (scores[1] is None):
            errors.append(f"{label}: only one score is present")
        if scores[0] is not None:
            expected = "D" if scores[0] == scores[1] else ("1" if scores[0] > scores[1] else "2")
            if game["outcome"] != expected:
                errors.append(f"{label}: score and outcome disagree")
    stats = build_statistics(games)
    for player in stats["players"]:
        if player["played"] != player["wins"] + player["draws"] + player["losses"]:
            errors.append(f"player totals disagree: {player['name']}")
    return errors

