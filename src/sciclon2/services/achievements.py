from __future__ import annotations

import sqlite3
from collections import defaultdict
from datetime import date

from .ratings import player_ratings
from .tournaments import calculated_tournament_champions


STREAK_LEVELS = ((5, "Bronce"), (7, "Plata"), (10, "Oro"))
UNBEATEN_LEVELS = ((5, "Bronce"), (8, "Plata"), (12, "Oro"), (15, "Legendario"))
GOAL_LEVELS = ((10, "Bronce"), (25, "Plata"), (50, "Oro"), (100, "Legendario"))
PARTNERSHIP_LEVELS = ((10, "Bronce"), (20, "Plata"), (30, "Oro"))
NEMESIS_LEVELS = ((5, "Bronce"), (7, "Plata"), (10, "Oro"))
PRIME_LEVELS = ((5, "Bronce"), (7, "Plata"), (10, "Oro"))


def _level(value: int, levels: tuple[tuple[int, str], ...]) -> tuple[int, str] | None:
    reached = [item for item in levels if value >= item[0]]
    return reached[-1] if reached else None


def _player_results(connection: sqlite3.Connection, competition: str) -> dict[int, list[sqlite3.Row]]:
    rows = connection.execute(
        "SELECT m.id, m.played_on, m.outcome, mp.player_id, mp.team_no, c.slug competition "
        "FROM matches m JOIN match_players mp ON mp.match_id=m.id "
        "JOIN tournaments t ON t.id=m.tournament_id JOIN competitions c ON c.id=t.competition_id "
        "WHERE c.slug=? AND m.voided_at IS NULL AND m.coverage_status='verified' AND m.outcome IN ('1','2','D') "
        "ORDER BY m.played_on, m.id", (competition,)
    ).fetchall()
    grouped: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        grouped[int(row["player_id"])].append(row)
    return grouped


def _result(row: sqlite3.Row) -> str:
    if row["outcome"] == "D":
        return "draw"
    return "win" if row["outcome"] == str(row["team_no"]) else "loss"


def _longest(results: list[sqlite3.Row], allowed: set[str]) -> tuple[int, str | None, str | None]:
    best = current = 0
    current_from = earned_from = earned_at = None
    for row in results:
        if _result(row) in allowed:
            if current == 0:
                current_from = row["played_on"]
            current += 1
            if current > best:
                best, earned_from, earned_at = current, current_from, row["played_on"]
        else:
            current = 0
            current_from = None
    return best, earned_from, earned_at


def _attendance_streak(connection: sqlite3.Connection, player_id: int, competition: str) -> tuple[int, str | None, str | None]:
    best = 0
    current_from = earned_from = earned_at = None
    dates = connection.execute(
        "SELECT m.played_on, MAX(CASE WHEN mp.player_id=? THEN 1 ELSE 0 END) present "
        "FROM matches m JOIN tournaments t ON t.id=m.tournament_id JOIN competitions c ON c.id=t.competition_id "
        "LEFT JOIN match_players mp ON mp.match_id=m.id WHERE c.slug=? AND m.voided_at IS NULL "
        "AND m.coverage_status='verified' AND m.outcome IN ('1','2','D') GROUP BY m.played_on ORDER BY m.played_on",
        (player_id, competition),
    ).fetchall()
    current = 0
    for row in dates:
        if row["present"]:
            if current == 0:
                current_from = row["played_on"]
            current += 1
        else:
            current = 0
            current_from = None
        if current > best:
            best, earned_from, earned_at = current, current_from, row["played_on"]
    return best, earned_from, earned_at


def _pair_records(connection: sqlite3.Connection, competition: str) -> tuple[dict[int, tuple[int, str, str, str]], dict[int, tuple[int, str, str, str]]]:
    rows = connection.execute(
        "SELECT m.id, m.played_on, m.outcome, a.player_id player_id, b.player_id other_id, "
        "p.canonical_name other_name, a.team_no team_a, b.team_no team_b "
        "FROM matches m JOIN match_players a ON a.match_id=m.id "
        "JOIN match_players b ON b.match_id=m.id AND b.player_id<>a.player_id "
        "JOIN players p ON p.id=b.player_id JOIN tournaments t ON t.id=m.tournament_id "
        "JOIN competitions c ON c.id=t.competition_id WHERE c.slug=? AND m.voided_at IS NULL "
        "AND m.coverage_status='verified' AND m.outcome IN ('1','2') ORDER BY m.played_on, m.id", (competition,)
    ).fetchall()
    together: dict[tuple[int, int], tuple[int, str, str]] = {}
    rivals: dict[tuple[int, int], tuple[int, str, str]] = {}
    for row in rows:
        if row["outcome"] != str(row["team_a"]):
            continue
        target = together if row["team_a"] == row["team_b"] else rivals
        key = (int(row["player_id"]), int(row["other_id"]))
        count, first_at, _ = target.get(key, (0, row["played_on"], row["played_on"]))
        target[key] = (count + 1, first_at, row["played_on"])
    names = {int(row["id"]): row["canonical_name"] for row in connection.execute("SELECT id,canonical_name FROM players")}
    def best(source: dict[tuple[int, int], tuple[int, str, str]]) -> dict[int, tuple[int, str, str, str]]:
        output: dict[int, tuple[int, str, str, str]] = {}
        for (player_id, other_id), (count, first_at, earned_at) in source.items():
            if player_id not in output or count > output[player_id][0]:
                output[player_id] = (count, names[other_id], first_at, earned_at)
        return output
    return best(together), best(rivals)


def _prime_streaks(connection: sqlite3.Connection, results: dict[int, list[sqlite3.Row]], competition: str) -> dict[int, tuple[int, str | None, str | None]]:
    dates = sorted({row["played_on"] for player_rows in results.values() for row in player_rows})
    ratings_by_date = {day: player_ratings(connection, date.fromisoformat(day), competition) for day in dates}
    output: dict[int, tuple[int, str | None]] = {}
    for player_id, player_rows in results.items():
        best = current = 0
        current_from = earned_from = earned_at = None
        for row in player_rows:
            rating = ratings_by_date[row["played_on"]].get(player_id)
            prime = bool(rating and rating["dynamic"] and rating["formScore"] >= 0.8)
            if prime:
                if current == 0:
                    current_from = row["played_on"]
                current += 1
            else:
                current = 0
                current_from = None
            if current > best:
                best, earned_from, earned_at = current, current_from, row["played_on"]
        output[player_id] = (best, earned_from, earned_at)
    return output


def player_achievements(connection: sqlite3.Connection, competition: str) -> dict[int, list[dict]]:
    """Rebuild patches from one competition's verified history; scopes are never mixed."""
    results = _player_results(connection, competition)
    partnerships, rivalries = _pair_records(connection, competition)
    prime_streaks = _prime_streaks(connection, results, competition)
    titles: dict[int, list[tuple[str, str]]] = defaultdict(list)
    unbeaten_titles: dict[int, list[tuple[str, str, str]]] = defaultdict(list)
    for tournament in connection.execute(
        "SELECT t.id,t.code,t.starts_on,t.ends_on FROM tournaments t JOIN competitions c ON c.id=t.competition_id "
        "WHERE c.slug=? ORDER BY t.ends_on,t.id", (competition,),
    ):
        for name in calculated_tournament_champions(connection, tournament["id"]):
            player = connection.execute("SELECT id FROM players WHERE canonical_name=?", (name,)).fetchone()
            if player:
                player_id = int(player["id"])
                titles[player_id].append((tournament["code"], tournament["ends_on"]))
                tournament_results = connection.execute(
                    "SELECT m.played_on,m.outcome,mp.team_no FROM matches m JOIN match_players mp ON mp.match_id=m.id "
                    "WHERE m.tournament_id=? AND mp.player_id=? AND m.voided_at IS NULL "
                    "AND m.coverage_status='verified' AND m.outcome IN ('1','2','D')",
                    (tournament["id"], player_id),
                ).fetchall()
                if tournament_results and all(
                    row["outcome"] == "D" or row["outcome"] == str(row["team_no"])
                    for row in tournament_results
                ):
                    played_dates = [row["played_on"] for row in tournament_results]
                    unbeaten_titles[player_id].append((tournament["code"], min(played_dates), max(played_dates)))
    goals = {int(row["player_id"]): int(row["goals"]) for row in connection.execute(
        "SELECT mg.player_id,SUM(mg.goal_count) goals FROM match_goals mg JOIN matches m ON m.id=mg.match_id "
        "JOIN tournaments t ON t.id=m.tournament_id JOIN competitions c ON c.id=t.competition_id "
        "WHERE c.slug=? AND mg.player_id IS NOT NULL AND m.voided_at IS NULL "
        "AND m.coverage_status='verified' GROUP BY mg.player_id", (competition,)
    )}
    output: dict[int, list[dict]] = defaultdict(list)
    def add(player_id: int, code: str, title: str, description: str, earned_at: str | None, level: str | None = None, progress: int | None = None, earned_from: str | None = None):
        output[player_id].append({"code": code, "title": title, "description": description, "earnedFrom": earned_from, "earnedAt": earned_at, "level": level, "progress": progress})
    for player_id, player_rows in results.items():
        played, last = len(player_rows), player_rows[-1]["played_on"]
        if played >= 60: add(player_id, "veteran", "Veterano", "Superó los 60 partidos registrados.", player_rows[59]["played_on"], progress=played, earned_from=player_rows[0]["played_on"])
        if played >= 100: add(player_id, "centenary", "Centenario", "Alcanzó los 100 partidos registrados.", player_rows[99]["played_on"], progress=played, earned_from=player_rows[0]["played_on"])
        won = titles.get(player_id, [])
        if won:
            champion_level = "Bronce" if len(won) == 1 else "Plata" if len(won) == 2 else "Oro"
            tournament_names = ", ".join(item[0] for item in won)
            add(
                player_id, "champion", "Campeón",
                f"Ganó {len(won)} torneo{'s' if len(won) != 1 else ''}: {tournament_names}.",
                won[min(len(won), 3) - 1][1], champion_level, len(won),
            )
        won_unbeaten = unbeaten_titles.get(player_id, [])
        if won_unbeaten:
            tournament_names = ", ".join(item[0] for item in won_unbeaten)
            add(
                player_id, "unbeaten_champion", "Campeón invicto",
                f"Salió campeón sin perder en {len(won_unbeaten)} torneo{'s' if len(won_unbeaten) != 1 else ''}: {tournament_names}.",
                won_unbeaten[-1][2], progress=len(won_unbeaten), earned_from=won_unbeaten[0][1],
            )
        wins, wins_from, wins_at = _longest(player_rows, {"win"})
        if win_level := _level(wins, STREAK_LEVELS): add(player_id, "winning_streak", "Racha ganadora", f"Encadenó {wins} victorias.", wins_at, win_level[1], wins, wins_from)
        unbeaten, unbeaten_from, unbeaten_at = _longest(player_rows, {"win", "draw"})
        if unbeaten_level := _level(unbeaten, UNBEATEN_LEVELS): add(player_id, "unbeaten", "Invicto", f"Estuvo {unbeaten} partidos sin perder.", unbeaten_at, unbeaten_level[1], unbeaten, unbeaten_from)
        scored = goals.get(player_id, 0)
        if goal_level := _level(scored, GOAL_LEVELS): add(player_id, "scorer", "Goleador", f"Marcó {scored} goles registrados.", last, goal_level[1], scored)
        attendance, attendance_from, attendance_at = _attendance_streak(connection, player_id, competition)
        if attendance >= 10: add(player_id, "always_present", "Siempre presente", f"Jugó {attendance} fechas consecutivas.", attendance_at, progress=attendance, earned_from=attendance_from)
        if partnerships.get(player_id, (0, "", ""))[0] >= 10:
            count, partner, first_at, earned_at = partnerships[player_id]
            partnership_level = _level(count, PARTNERSHIP_LEVELS)
            add(player_id, "partnership", "Sociedad", f"Ganó {count} partidos junto a {partner}.", earned_at, partnership_level[1], count, first_at)
        if rivalries.get(player_id, (0, "", ""))[0] >= 5:
            count, rival, first_at, earned_at = rivalries[player_id]
            nemesis_level = _level(count, NEMESIS_LEVELS)
            add(player_id, "nemesis", "Bestia negra", f"Venció {count} veces a {rival}.", earned_at, nemesis_level[1], count, first_at)
        prime, prime_from, prime_at = prime_streaks.get(player_id, (0, None, None))
        if prime >= 5:
            prime_level = _level(prime, PRIME_LEVELS)
            add(player_id, "prime_streak", "Prime sostenido", f"Se mantuvo en Prime Moment durante {prime} partidos consecutivos.", prime_at, prime_level[1], prime, prime_from)
    return dict(output)
