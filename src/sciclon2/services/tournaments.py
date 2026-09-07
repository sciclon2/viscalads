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
        champions = [item[0] for item in connection.execute(
            "SELECT p.canonical_name FROM tournament_champions tc "
            "JOIN players p ON p.id=tc.player_id WHERE tc.tournament_id=? ORDER BY p.canonical_name",
            (row["id"],),
        )]
        result.append({
            "id": row["id"], "code": row["code"], "displayName": row["display_name"],
            "startsOn": row["starts_on"] or row["first_match"],
            "endsOn": row["ends_on"] or row["last_match"],
            "matchdayCount": row["matchday_count"] or row["played_dates"],
            "matchCount": row["match_count"], "champions": champions,
        })
    return result


def create_tournament(connection: sqlite3.Connection, competition: str, payload: dict) -> int:
    name = str(payload.get("displayName", "")).strip()
    starts_on = str(payload.get("startsOn", "")).strip()
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
    connection.execute(
        "INSERT INTO audit_events(entity_type, entity_id, action, new_value, reason) VALUES ('tournament', ?, 'create', ?, 'Creado desde la interfaz')",
        (cursor.lastrowid, name),
    )
    return int(cursor.lastrowid)
