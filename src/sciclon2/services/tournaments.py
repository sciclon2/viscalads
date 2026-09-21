from __future__ import annotations

import re
import sqlite3
from datetime import date, timedelta


def list_tournaments(connection: sqlite3.Connection, competition: str) -> list[dict]:
    rows = connection.execute(
        "SELECT t.id, t.code, t.display_name, t.starts_on, t.ends_on, t.matchday_count, "
        "MIN(CASE WHEN m.voided_at IS NULL THEN m.played_on END) first_match, "
        "MAX(CASE WHEN m.voided_at IS NULL THEN m.played_on END) last_match, "
        "SUM(CASE WHEN m.id IS NOT NULL AND m.voided_at IS NULL THEN 1 ELSE 0 END) match_count, "
        "COUNT(DISTINCT CASE WHEN m.voided_at IS NULL THEN m.played_on END) played_dates "
        "FROM tournaments t JOIN competitions c ON c.id=t.competition_id "
        "LEFT JOIN matches m ON m.tournament_id=t.id "
        "WHERE c.slug=? GROUP BY t.id ORDER BY COALESCE(t.starts_on, first_match, '') DESC, t.id DESC",
        (competition,),
    ).fetchall()
    result = []
    for row in rows:
        # A live table has leaders, not champions. Exposing those leaders here
        # made first-matchday winners look like tournament winners elsewhere.
        closed = bool(row["ends_on"] and row["ends_on"] < date.today().isoformat())
        champions = calculated_tournament_champions(connection, row["id"]) if closed else []
        rules = [dict(item) for item in connection.execute(
            "SELECT rule_code AS code, threshold_value AS threshold, "
            "points_delta AS pointsDelta, description FROM tournament_rules "
            "WHERE tournament_id=? ORDER BY id", (row["id"],)
        )]
        result.append({
            "id": row["id"], "code": row["code"], "displayName": row["display_name"],
            "startsOn": row["starts_on"] or row["first_match"],
            "endsOn": row["ends_on"],
            "matchdayCount": row["matchday_count"] or row["played_dates"],
            "matchCount": row["match_count"], "champions": champions,
            "rules": rules,
            "standings": tournament_standings(connection, row["id"]),
        })
    return result


def calculated_tournament_champions(connection: sqlite3.Connection, tournament_id: int) -> list[str]:
    """Return every points leader; the historical table is only an audit reference."""
    table = [item for item in tournament_standings(connection, tournament_id) if item["played"] > 0]
    if not table:
        return []
    winning_points = max(item["totalPoints"] for item in table)
    return sorted(item["name"] for item in table if item["totalPoints"] == winning_points)


def create_tournament(connection: sqlite3.Connection, competition: str, payload: dict) -> int:
    name = str(payload.get("displayName", "")).strip()
    starts_on = str(payload.get("startsOn", "")).strip()
    # Keep the original boolean payload working for older web clients while the
    # rule code makes the creation contract extensible for future rule presets.
    rule_code = payload.get("ruleCode")
    if rule_code is None:
        rule_code = "goal_margin_loss" if bool(payload.get("goalMarginPenalty", False)) else "none"
    if rule_code not in {"none", "goal_margin_loss", "goal_margin_both"}:
        raise ValueError("Regla de torneo no válida")
    try:
        matchday_count = int(payload.get("matchdayCount", 0))
    except (TypeError, ValueError):
        raise ValueError("La cantidad de fechas debe ser un número entero") from None
    if not name:
        raise ValueError("El nombre del torneo es obligatorio")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", starts_on):
        raise ValueError("La fecha de inicio es obligatoria")
    if not 1 <= matchday_count <= 100:
        raise ValueError("La cantidad de fechas debe estar entre 1 y 100")
    try:
        ends_on = (date.fromisoformat(starts_on) + timedelta(days=7 * (matchday_count - 1))).isoformat()
    except ValueError:
        raise ValueError("La fecha de inicio no es válida") from None
    competition_row = connection.execute("SELECT id FROM competitions WHERE slug=?", (competition,)).fetchone()
    if not competition_row:
        raise ValueError("Competición desconocida")
    duplicate = connection.execute(
        "SELECT 1 FROM tournaments WHERE competition_id=? AND lower(display_name)=lower(?)",
        (competition_row[0], name),
    ).fetchone()
    if duplicate:
        raise ValueError("Ya existe un torneo con ese nombre")
    number = connection.execute(
        "SELECT COUNT(*)+1 FROM tournaments WHERE competition_id=?", (competition_row[0],)
    ).fetchone()[0]
    code = f"{competition.upper()}-{number}"
    while connection.execute("SELECT 1 FROM tournaments WHERE code=?", (code,)).fetchone():
        number += 1
        code = f"{competition.upper()}-{number}"
    cursor = connection.execute(
        "INSERT INTO tournaments(code, display_name, starts_on, ends_on, competition_id, matchday_count) VALUES (?,?,?,?,?,?)",
        (code, name, starts_on, ends_on, competition_row[0], matchday_count),
    )
    if rule_code == "goal_margin_loss":
        connection.execute(
            "INSERT INTO tournament_rules(tournament_id, rule_code, threshold_value, points_delta, description) "
            "VALUES (?, 'goal_margin_loss', 3, -1, '−1 punto por perder por una diferencia de 3 goles o más')",
            (cursor.lastrowid,),
        )
    elif rule_code == "goal_margin_both":
        connection.execute(
            "INSERT INTO tournament_rules(tournament_id, rule_code, threshold_value, points_delta, description) "
            "VALUES (?, 'goal_margin_both', 3, 1, '+1 al ganador y -1 al perdedor por cada 3 goles de diferencia')",
            (cursor.lastrowid,),
        )
    connection.execute(
        "INSERT INTO audit_events(entity_type, entity_id, action, new_value, reason) VALUES ('tournament', ?, 'create', ?, 'Creado desde la interfaz')",
        (cursor.lastrowid, name),
    )
    return int(cursor.lastrowid)


def tournament_standings(connection: sqlite3.Connection, tournament_id: int) -> list[dict]:
    """Calculate tournament-only points, including the tournament's immutable rules."""
    rules = connection.execute(
        "SELECT rule_code, threshold_value, points_delta FROM tournament_rules WHERE tournament_id=?",
        (tournament_id,),
    ).fetchall()
    rule_by_code = {row["rule_code"]: row for row in rules}
    matches = connection.execute(
        "SELECT id, outcome, score_team1, score_team2 FROM matches "
        "WHERE tournament_id=? AND voided_at IS NULL AND coverage_status='verified' "
        "AND outcome IN ('1','2','D') ORDER BY played_on, id",
        (tournament_id,),
    ).fetchall()
    tournament = connection.execute(
        "SELECT competition_id, ends_on FROM tournaments WHERE id=?", (tournament_id,)
    ).fetchone()
    eligible_players = []
    if tournament and tournament["ends_on"] >= date.today().isoformat():
        latest_match = connection.execute(
            "SELECT MAX(m.played_on) FROM matches m JOIN tournaments t ON t.id=m.tournament_id "
            "WHERE t.competition_id=? AND m.voided_at IS NULL AND m.coverage_status='verified'",
            (tournament["competition_id"],),
        ).fetchone()[0]
        if latest_match:
            cutoff = (date.fromisoformat(latest_match) - timedelta(days=90)).isoformat()
            eligible_players = connection.execute(
                "SELECT DISTINCT p.id player_id, p.canonical_name FROM competition_players cp "
                "JOIN players p ON p.id=cp.player_id "
                "JOIN match_players mp ON mp.player_id=p.id "
                "JOIN matches m ON m.id=mp.match_id "
                "JOIN tournaments mt ON mt.id=m.tournament_id "
                "WHERE cp.competition_id=? AND cp.active=1 AND mt.competition_id=cp.competition_id "
                "AND m.voided_at IS NULL AND m.coverage_status='verified' AND m.played_on>=? "
                "ORDER BY p.canonical_name COLLATE NOCASE",
                (tournament["competition_id"], cutoff),
            ).fetchall()
    rows: dict[int, dict] = {
        player["player_id"]: {
            "playerId": player["player_id"], "name": player["canonical_name"],
            "played": 0, "wins": 0, "draws": 0, "losses": 0,
            "goals": 0, "bonusMatches": 0, "positivePoints": 0,
            "penalizedMatches": 0, "negativePoints": 0,
        }
        for player in eligible_players
    }
    for match in matches:
        players = connection.execute(
            "SELECT mp.player_id, mp.team_no, p.canonical_name FROM match_players mp "
            "JOIN players p ON p.id=mp.player_id WHERE mp.match_id=?",
            (match["id"],),
        ).fetchall()
        margin_rule = rule_by_code.get("goal_margin_loss")
        both_margin_rule = rule_by_code.get("goal_margin_both")
        exact_margin = (
            abs(match["score_team1"] - match["score_team2"])
            if match["score_team1"] is not None and match["score_team2"] is not None
            else None
        )
        for player in players:
            item = rows.setdefault(player["player_id"], {
                "playerId": player["player_id"], "name": player["canonical_name"],
                "played": 0, "wins": 0, "draws": 0, "losses": 0,
                "goals": 0, "bonusMatches": 0, "positivePoints": 0,
                "penalizedMatches": 0, "negativePoints": 0,
            })
            item["played"] += 1
            team = str(player["team_no"])
            if match["outcome"] == "D":
                item["draws"] += 1
            elif match["outcome"] == team:
                item["wins"] += 1
                if both_margin_rule and exact_margin is not None:
                    bonus = exact_margin // int(both_margin_rule["threshold_value"])
                    if bonus:
                        item["bonusMatches"] += 1
                        item["positivePoints"] += bonus * int(both_margin_rule["points_delta"])
            else:
                item["losses"] += 1
                if both_margin_rule and exact_margin is not None:
                    penalty = exact_margin // int(both_margin_rule["threshold_value"])
                    if penalty:
                        item["penalizedMatches"] += 1
                        item["negativePoints"] -= penalty * int(both_margin_rule["points_delta"])
                elif margin_rule and exact_margin is not None and exact_margin >= margin_rule["threshold_value"]:
                    item["penalizedMatches"] += 1
                    item["negativePoints"] += int(margin_rule["points_delta"])
    goals = connection.execute(
        "SELECT mg.player_id, SUM(mg.goal_count) goals FROM match_goals mg "
        "JOIN matches m ON m.id=mg.match_id WHERE m.tournament_id=? "
        "AND m.voided_at IS NULL AND mg.player_id IS NOT NULL GROUP BY mg.player_id",
        (tournament_id,),
    ).fetchall()
    for goal in goals:
        if goal["player_id"] in rows:
            rows[goal["player_id"]]["goals"] = int(goal["goals"])
    result = []
    for item in rows.values():
        item["basePoints"] = item["wins"] * 3 + item["draws"]
        item["totalPoints"] = item["basePoints"] + item["positivePoints"] + item["negativePoints"]
        result.append(item)
    return sorted(result, key=lambda item: (
        -item["totalPoints"], -item["wins"], item["played"] == 0,
        item["played"], item["name"].lower(),
    ))
