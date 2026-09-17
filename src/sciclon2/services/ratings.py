from __future__ import annotations

import sqlite3
from datetime import date, timedelta

RATING_WINDOW_DAYS = 95
MIN_MATCHES = 5
MAX_MATCHES = 10
NEUTRAL_SCORE = 0.5
FORM_CONTRAST = 1.4
ABSENCE_THRESHOLD = 3
ABSENCE_PENALTY = 0.1


def player_ratings(
    connection: sqlite3.Connection,
    as_of: date | None = None,
    competition: str | None = None,
) -> dict[int, dict]:
    """Calculate one position-independent rating, optionally scoped to one competition."""
    reference = as_of or date.today()
    cutoff = reference - timedelta(days=RATING_WINDOW_DAYS)
    ranges = connection.execute(
        "SELECT player_id, min_rating, max_rating FROM player_rating_ranges"
    ).fetchall()
    ratings: dict[int, dict] = {}
    competition_clause = "AND c.slug=? " if competition else ""
    match_parameters: list[object] = [reference.isoformat()]
    if competition:
        match_parameters.append(competition)
    recent_match_rows = connection.execute(
        "SELECT m.id, mp.player_id FROM matches m "
        "JOIN tournaments t ON t.id=m.tournament_id "
        "JOIN competitions c ON c.id=t.competition_id "
        "LEFT JOIN match_players mp ON mp.match_id=m.id "
        "WHERE m.coverage_status='verified' AND m.outcome IN ('1','2','D') "
        "AND m.played_on<=? " + competition_clause +
        "ORDER BY m.played_on DESC, m.id DESC",
        match_parameters,
    ).fetchall()
    match_ids: list[int] = []
    participants: dict[int, set[int]] = {}
    for match in recent_match_rows:
        match_id = int(match["id"])
        if match_id not in participants:
            match_ids.append(match_id)
            participants[match_id] = set()
        if match["player_id"] is not None:
            participants[match_id].add(int(match["player_id"]))

    for row in ranges:
        player_id = row["player_id"]
        minimum = float(row["min_rating"])
        maximum = float(row["max_rating"])
        midpoint = (minimum + maximum) / 2
        parameters = [player_id, cutoff.isoformat(), reference.isoformat()]
        if competition:
            parameters.append(competition)
        parameters.append(MAX_MATCHES)
        results = connection.execute(
            "SELECT m.played_on, m.outcome, mp.team_no "
            "FROM match_players mp JOIN matches m ON m.id=mp.match_id "
            "JOIN tournaments t ON t.id=m.tournament_id "
            "JOIN competitions c ON c.id=t.competition_id "
            "WHERE mp.player_id=? AND m.coverage_status='verified' "
            "AND m.outcome IN ('1','2','D') AND m.played_on BETWEEN ? AND ? "
            + competition_clause +
            "ORDER BY m.played_on DESC, m.id DESC LIMIT ?",
            parameters,
        ).fetchall()
        played = len(results)
        if played < MIN_MATCHES:
            score = NEUTRAL_SCORE
            rating = midpoint
            active = False
        else:
            earned = sum(
                NEUTRAL_SCORE if result["outcome"] == "D"
                else 1.0 if result["outcome"] == str(result["team_no"])
                else 0.0
                for result in results
            )
            earned += (MAX_MATCHES - played) * NEUTRAL_SCORE
            raw_score = earned / MAX_MATCHES
            score = max(0.0, min(1.0, NEUTRAL_SCORE + (raw_score - NEUTRAL_SCORE) * FORM_CONTRAST))
            rating = minimum + (maximum - minimum) * score
            active = True
        missed_matches = 0
        for match_id in match_ids:
            if player_id in participants[match_id]:
                break
            missed_matches += 1
        absence_penalty = missed_matches >= ABSENCE_THRESHOLD
        if absence_penalty:
            score = max(0.0, score - ABSENCE_PENALTY)
            rating = minimum + (maximum - minimum) * score
        ratings[player_id] = {
            "min": minimum,
            "max": maximum,
            "current": round(rating, 2),
            "midpoint": round(midpoint, 2),
            "recentMatches": played,
            "formScore": round(score, 3),
            "dynamic": active,
            "windowDays": RATING_WINDOW_DAYS,
            "missedMatches": missed_matches,
            "absencePenalty": absence_penalty,
            "absencePenaltyPercent": int(ABSENCE_PENALTY * 100) if absence_penalty else 0,
        }
    return ratings


def player_rating_history(connection: sqlite3.Connection, competition: str) -> dict[int, list[dict]]:
    """Rebuild each player's rating on every verified matchday without future data."""
    matchdays = connection.execute(
        "SELECT m.id, m.played_on, m.outcome, m.score_team1, m.score_team2, t.code tournament "
        "FROM matches m JOIN tournaments t ON t.id=m.tournament_id "
        "JOIN competitions c ON c.id=t.competition_id "
        "WHERE c.slug=? AND m.voided_at IS NULL AND m.coverage_status='verified' "
        "AND m.outcome IN ('1','2','D') ORDER BY m.played_on, m.id",
        (competition,),
    ).fetchall()
    history: dict[int, list[dict]] = {int(row[0]): [] for row in connection.execute(
        "SELECT player_id FROM player_rating_ranges"
    )}
    seen_players: set[int] = set()
    for match in matchdays:
        ratings = player_ratings(connection, date.fromisoformat(match["played_on"]), competition)
        participants = {
            int(row["player_id"]): int(row["team_no"])
            for row in connection.execute(
                "SELECT player_id, team_no FROM match_players WHERE match_id=?",
                (match["id"],),
            )
        }
        seen_players.update(participants)
        for player_id, rating in ratings.items():
            if player_id not in seen_players:
                continue
            team_no = participants.get(player_id)
            result = None
            if team_no is not None:
                result = "D" if match["outcome"] == "D" else (
                    "W" if match["outcome"] == str(team_no) else "L"
                )
            history[player_id].append({
                "date": match["played_on"],
                "tournament": match["tournament"],
                "current": rating["current"],
                "formScore": rating["formScore"],
                "recentMatches": rating["recentMatches"],
                "dynamic": rating["dynamic"],
                "missedMatches": rating["missedMatches"],
                "absencePenalty": rating["absencePenalty"],
                "participated": team_no is not None,
                "result": result,
                "score1": match["score_team1"],
                "score2": match["score_team2"],
            })
    return history
