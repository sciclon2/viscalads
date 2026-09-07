from __future__ import annotations

import sqlite3
from datetime import date, timedelta

RATING_WINDOW_DAYS = 90
MIN_MATCHES = 5
MAX_MATCHES = 10
NEUTRAL_SCORE = 0.5
FORM_CONTRAST = 1.4


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

    for row in ranges:
        player_id = row["player_id"]
        minimum = float(row["min_rating"])
        maximum = float(row["max_rating"])
        midpoint = (minimum + maximum) / 2
        competition_clause = "AND c.slug=? " if competition else ""
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
        ratings[player_id] = {
            "min": minimum,
            "max": maximum,
            "current": round(rating, 2),
            "midpoint": round(midpoint, 2),
            "recentMatches": played,
            "formScore": round(score, 3),
            "dynamic": active,
            "windowDays": RATING_WINDOW_DAYS,
        }
    return ratings
