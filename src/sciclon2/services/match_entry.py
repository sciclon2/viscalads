from __future__ import annotations

import sqlite3
from datetime import datetime, timezone


def _competition_id(connection: sqlite3.Connection, slug: str) -> int:
    row = connection.execute("SELECT id FROM competitions WHERE slug=?", (slug,)).fetchone()
    if not row:
        raise ValueError("Competición desconocida")
    return row[0]


def _tournament_id(
    connection: sqlite3.Connection,
    competition_id: int,
    played_on: str,
    requested_id: int | None = None,
) -> int:
    if requested_id is not None:
        selected = connection.execute(
            "SELECT id FROM tournaments WHERE id=? AND competition_id=?",
            (requested_id, competition_id),
        ).fetchone()
        if not selected:
            raise ValueError("El torneo seleccionado no pertenece a esta competición")
        return int(selected[0])
    row = connection.execute(
        "SELECT id FROM tournaments WHERE competition_id=? "
        "ORDER BY CASE WHEN starts_on<=? AND (ends_on IS NULL OR ends_on>=?) THEN 0 ELSE 1 END, "
        "COALESCE(ends_on, starts_on) DESC, id DESC LIMIT 1",
        (competition_id, played_on, played_on),
    ).fetchone()
    if not row:
        raise ValueError("La competición no tiene una edición donde guardar el partido")
    return row[0]


def recent_lineups(connection: sqlite3.Connection, competition: str) -> list[dict]:
    competition_id = _competition_id(connection, competition)
    rows = connection.execute(
        "SELECT id, created_at FROM generated_lineups WHERE competition_id=? "
        "ORDER BY created_at DESC, id DESC LIMIT 5", (competition_id,),
    ).fetchall()
    result = []
    for row in rows:
        members = connection.execute(
            "SELECT glm.player_id, p.canonical_name, glm.team_no FROM generated_lineup_members glm "
            "JOIN players p ON p.id=glm.player_id WHERE glm.lineup_id=? "
            "ORDER BY glm.team_no, glm.lineup_order", (row["id"],),
        ).fetchall()
        guests = connection.execute(
            "SELECT guest_label, team_no, level, primary_position FROM generated_lineup_guests "
            "WHERE lineup_id=? ORDER BY team_no, lineup_order", (row["id"],),
        ).fetchall()
        result.append({
            "id": row["id"], "createdAt": row["created_at"],
            "team1": [dict(member) for member in members if member["team_no"] == 1],
            "team2": [dict(member) for member in members if member["team_no"] == 2],
            "guest1": [dict(guest) for guest in guests if guest["team_no"] == 1],
            "guest2": [dict(guest) for guest in guests if guest["team_no"] == 2],
        })
    return result


def save_lineup(connection: sqlite3.Connection, competition: str, teams: list[list]) -> int:
    competition_id = _competition_id(connection, competition)
    if len(teams) != 2 or not any(teams):
        raise ValueError("La formación debe tener dos equipos")
    normalized = [
        [member if isinstance(member, dict) else {"playerId": member} for member in team]
        for team in teams
    ]
    player_ids = [int(member["playerId"]) for team in normalized for member in team if member.get("playerId")]
    guest_labels = [str(member.get("guestName", "")).strip() for team in normalized for member in team if not member.get("playerId")]
    if len(player_ids) != len(set(player_ids)) or any(not label for label in guest_labels) or len(guest_labels) != len(set(guest_labels)):
        raise ValueError("La formación debe tener dos equipos sin jugadores repetidos")
    if player_ids:
        known = connection.execute(
            f"SELECT COUNT(*) FROM players WHERE id IN ({','.join('?' for _ in player_ids)})", player_ids
        ).fetchone()[0]
        if known != len(player_ids):
            raise ValueError("La formación contiene jugadores desconocidos")
    cursor = connection.execute(
        "INSERT INTO generated_lineups(competition_id) VALUES (?)", (competition_id,)
    )
    lineup_id = cursor.lastrowid
    for team_no, team in enumerate(normalized, 1):
        for order, member in enumerate(team, 1):
            if member.get("playerId"):
                connection.execute(
                    "INSERT INTO generated_lineup_members(lineup_id, player_id, team_no, lineup_order) VALUES (?, ?, ?, ?)",
                    (lineup_id, int(member["playerId"]), team_no, order),
                )
            else:
                level = float(member.get("level", 5))
                if level < 1 or level > 10:
                    raise ValueError("El nivel del invitado debe estar entre 1 y 10")
                connection.execute(
                    "INSERT INTO generated_lineup_guests(lineup_id, guest_label, team_no, lineup_order, level, primary_position) VALUES (?, ?, ?, ?, ?, ?)",
                    (lineup_id, str(member["guestName"]).strip(), team_no, order, level, str(member.get("position", "")).strip() or None),
                )
    stale = connection.execute(
        "SELECT id FROM generated_lineups WHERE competition_id=? "
        "ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 5", (competition_id,),
    ).fetchall()
    if stale:
        connection.executemany("DELETE FROM generated_lineups WHERE id=?", stale)
    connection.commit()
    return lineup_id


def save_match(connection: sqlite3.Connection, payload: dict, match_id: int | None = None) -> int:
    played_on = str(payload.get("playedOn", ""))
    try:
        datetime.strptime(played_on, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("La fecha no es válida") from exc
    competition_id = _competition_id(connection, str(payload.get("competition", "")))
    requested_tournament = payload.get("tournamentId")
    tournament_id = _tournament_id(
        connection,
        competition_id,
        played_on,
        int(requested_tournament) if requested_tournament not in (None, "") else None,
    )
    teams = payload.get("teams")
    if not isinstance(teams, list) or len(teams) != 2 or any(not team for team in teams):
        raise ValueError("Ambos equipos necesitan participantes")

    player_ids = [int(member["playerId"]) for team in teams for member in team if member.get("playerId")]
    if len(player_ids) != len(set(player_ids)):
        raise ValueError("Un jugador no puede aparecer en los dos equipos")
    if player_ids:
        placeholders = ",".join("?" for _ in player_ids)
        eligible = connection.execute(
            f"SELECT COUNT(*) FROM competition_players WHERE competition_id=? "
            f"AND active=1 AND player_id IN ({placeholders})",
            (competition_id, *player_ids),
        ).fetchone()[0]
        if eligible != len(player_ids):
            raise ValueError("Hay jugadores que no pertenecen a esta competición")
    guest_labels = [str(member.get("guestName", "")).strip() for team in teams for member in team if not member.get("playerId")]
    if any(not label for label in guest_labels) or len(guest_labels) != len(set(guest_labels)):
        raise ValueError("Cada invitado necesita un nombre temporal único")

    goals = payload.get("goals", [])
    scores = [0, 0]
    roster = {
        (team_no, str(member.get("playerId") or member.get("guestName", "")).strip())
        for team_no, team in enumerate(teams, 1) for member in team
    }
    for goal in goals:
        team_no = int(goal.get("teamNo", 0))
        count = int(goal.get("count", 0))
        if team_no not in (1, 2) or count < 1:
            raise ValueError("Los goles no son válidos")
        scorer = str(goal.get("playerId") or goal.get("guestName", "")).strip()
        if scorer and (team_no, scorer) not in roster:
            raise ValueError("El goleador no pertenece al equipo indicado")
        scores[team_no - 1] += count
    outcome = "D" if scores[0] == scores[1] else ("1" if scores[0] > scores[1] else "2")

    with connection:
        if match_id is None:
            cursor = connection.execute(
                "INSERT INTO matches(played_on, tournament_id, score_team1, score_team2, outcome, "
                "result_quality, coverage_status, evidence_summary, notes) "
                "VALUES (?, ?, ?, ?, ?, 'exact score', 'verified', 'Carga manual desde Viscalads', ?)",
                (played_on, tournament_id, scores[0], scores[1], outcome, str(payload.get("notes", ""))),
            )
            match_id = cursor.lastrowid
            action = "created"
        else:
            exists = connection.execute("SELECT id FROM matches WHERE id=? AND voided_at IS NULL", (match_id,)).fetchone()
            if not exists:
                raise ValueError("El partido no existe")
            connection.execute(
                "UPDATE matches SET played_on=?, tournament_id=?, score_team1=?, score_team2=?, "
                "outcome=?, result_quality='exact score', coverage_status='verified', notes=?, "
                "updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (played_on, tournament_id, scores[0], scores[1], outcome, str(payload.get("notes", "")), match_id),
            )
            connection.execute("DELETE FROM match_goals WHERE match_id=?", (match_id,))
            connection.execute("DELETE FROM match_guests WHERE match_id=?", (match_id,))
            connection.execute("DELETE FROM match_players WHERE match_id=?", (match_id,))
            action = "updated"

        guest_ids: dict[str, int] = {}
        for team_no, team in enumerate(teams, 1):
            official_order = 1
            guest_order = 1
            for member in team:
                if member.get("playerId"):
                    connection.execute(
                        "INSERT INTO match_players(match_id, player_id, team_no, lineup_order) VALUES (?, ?, ?, ?)",
                        (match_id, int(member["playerId"]), team_no, official_order),
                    )
                    official_order += 1
                else:
                    label = str(member["guestName"]).strip()
                    cursor = connection.execute(
                        "INSERT INTO match_guests(match_id, guest_label, team_no, lineup_order) VALUES (?, ?, ?, ?)",
                        (match_id, label, team_no, guest_order),
                    )
                    guest_ids[label] = cursor.lastrowid
                    guest_order += 1

        for goal in goals:
            player_id = goal.get("playerId")
            guest_name = str(goal.get("guestName", "")).strip()
            if not player_id and not guest_name:
                continue
            connection.execute(
                "INSERT INTO match_goals(match_id, team_no, player_id, guest_id, goal_count) VALUES (?, ?, ?, ?, ?)",
                (match_id, int(goal["teamNo"]), int(player_id) if player_id else None,
                 guest_ids.get(guest_name), int(goal["count"])),
            )
        connection.execute(
            "INSERT INTO evidence(match_id, evidence_type, excerpt, confidence) VALUES (?, 'manual', ?, 'confirmed')",
            (match_id, "Partido cargado manualmente desde la interfaz"),
        )
        connection.execute(
            "INSERT INTO audit_events(entity_type, entity_id, action, reason) VALUES ('match', ?, ?, ?)",
            (match_id, action, "Carga manual desde Viscalads"),
        )
    return match_id


def void_match(connection: sqlite3.Connection, match_id: int, reason: str) -> None:
    reason = reason.strip() or "Anulado desde la interfaz"
    with connection:
        cursor = connection.execute(
            "UPDATE matches SET voided_at=?, void_reason=?, updated_at=CURRENT_TIMESTAMP "
            "WHERE id=? AND voided_at IS NULL",
            (datetime.now(timezone.utc).isoformat(), reason, match_id),
        )
        if cursor.rowcount != 1:
            raise ValueError("El partido no existe o ya está anulado")
        connection.execute(
            "INSERT INTO audit_events(entity_type, entity_id, action, reason) VALUES ('match', ?, 'voided', ?)",
            (match_id, reason),
        )
