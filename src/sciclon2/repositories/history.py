from __future__ import annotations

import sqlite3


def matches(connection: sqlite3.Connection) -> list[dict]:
    base = connection.execute(
        "SELECT m.*, t.code AS tournament, c.slug AS competition, "
        "c.display_name AS competition_name FROM matches m "
        "LEFT JOIN tournaments t ON t.id=m.tournament_id "
        "LEFT JOIN competitions c ON c.id=t.competition_id ORDER BY m.played_on, m.id"
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
        "SELECT p.id, p.canonical_name, p.active, p.notes, p.photo_path, pp.position, pp.priority "
        "FROM players p LEFT JOIN player_positions pp ON pp.player_id=p.id "
        "ORDER BY p.canonical_name COLLATE NOCASE, pp.priority"
    ).fetchall()
    grouped: dict[int, dict] = {}
    for row in rows:
        profile = grouped.setdefault(row["id"], {
            "name": row["canonical_name"], "active": bool(row["active"]),
            "notes": row["notes"], "photo": row["photo_path"] or "", "positions": [],
        })
        if row["position"]:
            profile["positions"].append(row["position"])
    memberships = connection.execute(
        "SELECT cp.player_id, c.slug FROM competition_players cp "
        "JOIN competitions c ON c.id=cp.competition_id WHERE cp.active=1 "
        "ORDER BY c.id"
    ).fetchall()
    for row in memberships:
        if row["player_id"] in grouped:
            grouped[row["player_id"]].setdefault("competitions", []).append(row["slug"])
    for profile in grouped.values():
        profile.setdefault("competitions", [])
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


def competitions(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        "SELECT c.slug, c.display_name, c.usual_weekday, c.venue, c.active, "
        "COUNT(DISTINCT t.id) AS tournament_count, COUNT(DISTINCT m.id) AS match_count "
        "FROM competitions c LEFT JOIN tournaments t ON t.competition_id=c.id "
        "LEFT JOIN matches m ON m.tournament_id=t.id GROUP BY c.id ORDER BY c.id"
    ).fetchall()
    return [dict(row) for row in rows]
