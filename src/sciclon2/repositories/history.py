from __future__ import annotations

import sqlite3


def matches(connection: sqlite3.Connection) -> list[dict]:
    base = connection.execute(
        "SELECT m.*, t.code AS tournament, c.slug AS competition, "
        "c.display_name AS competition_name FROM matches m "
        "LEFT JOIN tournaments t ON t.id=m.tournament_id "
        "LEFT JOIN competitions c ON c.id=t.competition_id "
        "WHERE m.voided_at IS NULL ORDER BY m.played_on, m.id"
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
        guests = connection.execute(
            "SELECT guest_label, team_no FROM match_guests WHERE match_id=? "
            "ORDER BY team_no, lineup_order", (row["id"],)
        ).fetchall()
        game["guests"] = [dict(guest) for guest in guests]
        game["goals"] = [dict(goal) for goal in connection.execute(
            "SELECT mg.team_no, mg.goal_count, p.canonical_name AS player_name, "
            "g.guest_label FROM match_goals mg "
            "LEFT JOIN players p ON p.id=mg.player_id "
            "LEFT JOIN match_guests g ON g.id=mg.guest_id "
            "WHERE mg.match_id=? ORDER BY mg.team_no, mg.id", (row["id"],)
        ).fetchall()]
        result.append(game)
    return result


def profiles(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        "SELECT p.id, p.canonical_name, p.active, p.notes, p.photo_path, pp.position, pp.priority, "
        "pd.first_name, pd.last_name, pd.nickname, pd.birth_date, pd.nationality, "
        "pd.preferred_foot, pd.bio "
        "FROM players p LEFT JOIN player_positions pp ON pp.player_id=p.id "
        "LEFT JOIN player_details pd ON pd.player_id=p.id "
        "ORDER BY p.canonical_name COLLATE NOCASE, pp.priority"
    ).fetchall()
    grouped: dict[int, dict] = {}
    for row in rows:
        profile = grouped.setdefault(row["id"], {
            "id": row["id"], "name": row["canonical_name"], "active": bool(row["active"]),
            "notes": row["notes"], "photo": row["photo_path"] or "", "positions": [],
            "first_name": row["first_name"] or "", "last_name": row["last_name"] or "",
            "nickname": row["nickname"] or "", "birth_date": row["birth_date"] or "",
            "nationality": row["nationality"] or "",
            "preferred_foot": row["preferred_foot"] or "", "bio": row["bio"] or "",
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
        "LEFT JOIN matches m ON m.tournament_id=t.id AND m.voided_at IS NULL "
        "GROUP BY c.id ORDER BY c.id"
    ).fetchall()
    return [dict(row) for row in rows]


def venues(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        "SELECT v.*, c.slug AS competition, cv.role, cv.display_order "
        "FROM venues v JOIN competition_venues cv ON cv.venue_id=v.id "
        "JOIN competitions c ON c.id=cv.competition_id "
        "ORDER BY c.id, cv.display_order, v.display_name"
    ).fetchall()
    result = []
    for row in rows:
        venue = dict(row)
        venue["facts"] = [dict(fact) for fact in connection.execute(
            "SELECT category, fact_text FROM venue_facts WHERE venue_id=? "
            "ORDER BY display_order, id", (row["id"],)
        ).fetchall()]
        venue["photos"] = [dict(photo) for photo in connection.execute(
            "SELECT taken_on, image_url, caption, photo_type, source_url "
            "FROM venue_photos WHERE venue_id=? "
            "ORDER BY taken_on DESC, display_order, id", (row["id"],)
        ).fetchall()]
        result.append(venue)
    return result
