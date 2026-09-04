from __future__ import annotations

import sqlite3


def matches(connection: sqlite3.Connection) -> list[dict]:
    base = connection.execute(
        "SELECT m.*, t.code AS tournament FROM matches m "
        "LEFT JOIN tournaments t ON t.id=m.tournament_id ORDER BY m.played_on, m.id"
    ).fetchall()
    result = []
    for row in base:
        game = dict(row)
        players = connection.execute(
            "SELECT p.canonical_name, mp.team_no FROM match_players mp "
            "JOIN players p ON p.id=mp.player_id WHERE mp.match_id=? "
            "ORDER BY mp.team_no, mp.lineup_order",
            (row["id"],),
        ).fetchall()
        game["team1"] = [p["canonical_name"] for p in players if p["team_no"] == 1]
        game["team2"] = [p["canonical_name"] for p in players if p["team_no"] == 2]
        result.append(game)
    return result


def profiles(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        "SELECT p.id, p.canonical_name, p.active, p.notes, pp.position, pp.priority "
        "FROM players p LEFT JOIN player_positions pp ON pp.player_id=p.id "
        "ORDER BY p.canonical_name COLLATE NOCASE, pp.priority"
    ).fetchall()
    grouped: dict[int, dict] = {}
    for row in rows:
        profile = grouped.setdefault(row["id"], {
            "name": row["canonical_name"], "active": bool(row["active"]),
            "notes": row["notes"], "positions": [],
        })
        if row["position"]:
            profile["positions"].append(row["position"])
    return list(grouped.values())


def champions(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        "SELECT t.code, p.canonical_name FROM tournament_champions tc "
        "JOIN tournaments t ON t.id=tc.tournament_id JOIN players p ON p.id=tc.player_id "
        "ORDER BY t.id, p.canonical_name"
    ).fetchall()
    grouped: dict[str, list[str]] = {}
    for row in rows:
        grouped.setdefault(row["code"], []).append(row["canonical_name"])
    return [{"tournament": tournament, "winner": " + ".join(winners)} for tournament, winners in grouped.items()]

