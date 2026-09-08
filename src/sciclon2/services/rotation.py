from __future__ import annotations

import sqlite3


def consecutive_appearances(connection: sqlite3.Connection, competition: str) -> dict[int, int]:
    """Calculate appearance streaks in the newest tournament of a competition."""
    tournament = connection.execute(
        "SELECT t.id FROM tournaments t JOIN competitions c ON c.id=t.competition_id "
        "WHERE c.slug=? ORDER BY COALESCE(t.starts_on, '') DESC, t.id DESC LIMIT 1",
        (competition,),
    ).fetchone()
    if not tournament:
        return {}
    rows = connection.execute(
        "SELECT m.id, mp.player_id FROM matches m "
        "LEFT JOIN match_players mp ON mp.match_id=m.id "
        "WHERE m.tournament_id=? AND m.voided_at IS NULL "
        "AND m.coverage_status='verified' AND m.outcome IN ('1','2','D') "
        "ORDER BY m.played_on DESC, m.id DESC",
        (tournament["id"],),
    ).fetchall()
    match_ids: list[int] = []
    participants: dict[int, set[int]] = {}
    all_players: set[int] = set()
    for row in rows:
        match_id = int(row["id"])
        if match_id not in participants:
            match_ids.append(match_id)
            participants[match_id] = set()
        if row["player_id"] is not None:
            player_id = int(row["player_id"])
            participants[match_id].add(player_id)
            all_players.add(player_id)
    streaks: dict[int, int] = {}
    for player_id in all_players:
        streak = 0
        for match_id in match_ids:
            if player_id not in participants[match_id]:
                break
            streak += 1
        streaks[player_id] = streak
    return streaks
