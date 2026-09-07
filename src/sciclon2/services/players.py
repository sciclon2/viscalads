from __future__ import annotations

import sqlite3
import base64
import binascii
from datetime import datetime
from pathlib import Path

from sciclon2.config import PROJECT_ROOT

POSITIONS = {
    "Defensa por derecha", "Defensa por izquierda", "Defensor central",
    "Delantero", "Delantero por izquierda", "Mediocampo central", "Portero",
    "Mediocampo por derecha", "Mediocampo por izquierda",
}
FEET = {"Izquierda", "Derecha", "Ambas"}
PHOTO_DIR = PROJECT_ROOT / "web-stats" / "public" / "players"


def _update_photo(connection: sqlite3.Connection, player_id: int, payload: dict) -> None:
    if "photoData" not in payload or not payload.get("photoData"):
        return
    value = str(payload["photoData"])
    try:
        header, encoded = value.split(",", 1)
        mime = header.removeprefix("data:").split(";", 1)[0]
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("La foto no es válida") from exc
    extensions = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
    extension = extensions.get(mime)
    signatures_ok = (
        mime == "image/jpeg" and content.startswith(b"\xff\xd8\xff")
        or mime == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n")
        or mime == "image/webp" and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    )
    if not extension or not signatures_ok:
        raise ValueError("La foto debe ser JPG, PNG o WebP")
    if not content or len(content) > 5 * 1024 * 1024:
        raise ValueError("La foto no puede superar los 5 MB")
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"player-{player_id}.{extension}"
    (PHOTO_DIR / filename).write_bytes(content)
    connection.execute(
        "UPDATE players SET photo_path=?, photo_source_url=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (f"/players/{filename}", player_id),
    )


def create_player(connection: sqlite3.Connection, competition: str, payload: dict) -> int:
    name = str(payload.get("name", "")).strip()
    if not name:
        raise ValueError("El nombre del jugador es obligatorio")
    competition_row = connection.execute(
        "SELECT id FROM competitions WHERE slug=?", (competition,)
    ).fetchone()
    if not competition_row:
        raise ValueError("La competición no existe")
    if connection.execute(
        "SELECT 1 FROM players WHERE canonical_name=? COLLATE NOCASE", (name,)
    ).fetchone():
        raise ValueError("Ya existe un jugador con ese nombre")
    with connection:
        cursor = connection.execute(
            "INSERT INTO players(canonical_name, notes) VALUES (?, ?)",
            (name, str(payload.get("notes", "")).strip()),
        )
        player_id = cursor.lastrowid
        connection.execute(
            "INSERT INTO competition_players(competition_id, player_id, active, joined_on, notes) "
            "VALUES (?, ?, 1, date('now'), '')",
            (competition_row[0], player_id),
        )
        update_player(connection, player_id, payload)
        connection.execute(
            "INSERT INTO audit_events(entity_type, entity_id, action, new_value, reason) "
            "VALUES ('player', ?, 'created', ?, ?)",
            (player_id, name, f"Alta en {competition}"),
        )
    return player_id


def remove_player_from_competition(
    connection: sqlite3.Connection, player_id: int, competition: str
) -> None:
    row = connection.execute(
        "SELECT cp.active, p.canonical_name FROM competition_players cp "
        "JOIN competitions c ON c.id=cp.competition_id "
        "JOIN players p ON p.id=cp.player_id "
        "WHERE cp.player_id=? AND c.slug=?",
        (player_id, competition),
    ).fetchone()
    if not row or not row["active"]:
        raise ValueError("El jugador no está activo en esta competición")
    with connection:
        connection.execute(
            "UPDATE competition_players SET active=0, updated_at=CURRENT_TIMESTAMP "
            "WHERE player_id=? AND competition_id=(SELECT id FROM competitions WHERE slug=?)",
            (player_id, competition),
        )
        connection.execute(
            "INSERT INTO audit_events(entity_type, entity_id, action, old_value, new_value, reason) "
            "VALUES ('competition_player', ?, 'deactivated', ?, ?, ?)",
            (player_id, row["canonical_name"], competition, "Baja desde la sección Jugadores"),
        )


def reactivate_player_in_competition(
    connection: sqlite3.Connection, player_id: int, competition: str
) -> None:
    row = connection.execute(
        "SELECT cp.active, p.canonical_name FROM competition_players cp "
        "JOIN competitions c ON c.id=cp.competition_id "
        "JOIN players p ON p.id=cp.player_id "
        "WHERE cp.player_id=? AND c.slug=?",
        (player_id, competition),
    ).fetchone()
    if not row:
        raise ValueError("El jugador no pertenece a esta competición")
    if row["active"]:
        raise ValueError("El jugador ya está activo en esta competición")
    with connection:
        connection.execute(
            "UPDATE competition_players SET active=1, updated_at=CURRENT_TIMESTAMP "
            "WHERE player_id=? AND competition_id=(SELECT id FROM competitions WHERE slug=?)",
            (player_id, competition),
        )
        connection.execute(
            "INSERT INTO audit_events(entity_type, entity_id, action, old_value, new_value, reason) "
            "VALUES ('competition_player', ?, 'reactivated', ?, ?, ?)",
            (player_id, row["canonical_name"], competition, "Reactivación desde la sección Jugadores"),
        )


def update_player(connection: sqlite3.Connection, player_id: int, payload: dict) -> None:
    player = connection.execute("SELECT * FROM players WHERE id=?", (player_id,)).fetchone()
    if not player:
        raise ValueError("El jugador no existe")

    canonical_name = str(payload.get("name", "")).strip()
    if not canonical_name:
        raise ValueError("El nombre del jugador es obligatorio")
    active = 1 if payload.get("active", True) else 0
    primary = str(payload.get("primary", "")).strip()
    alternate = str(payload.get("alternate", "")).strip()
    if primary not in POSITIONS:
        raise ValueError("La posición principal no es válida")
    if alternate and alternate not in POSITIONS:
        raise ValueError("La posición alternativa no es válida")
    if alternate == primary:
        raise ValueError("La posición alternativa debe ser diferente")

    birth_date = str(payload.get("birthDate", "")).strip() or None
    if birth_date:
        try:
            datetime.strptime(birth_date, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("La fecha de nacimiento no es válida") from exc
    foot = str(payload.get("preferredFoot", "")).strip() or None
    if foot and foot not in FEET:
        raise ValueError("La pierna hábil no es válida")

    raw_min, raw_max = payload.get("ratingMin"), payload.get("ratingMax")
    has_range = raw_min not in (None, "") or raw_max not in (None, "")
    if has_range:
        if raw_min in (None, "") or raw_max in (None, ""):
            raise ValueError("El rango necesita mínimo y máximo")
        minimum, maximum = float(raw_min), float(raw_max)
        if not 1 <= minimum <= maximum <= 10:
            raise ValueError("El rango debe estar entre 1 y 10 y el mínimo no puede superar al máximo")

    with connection:
        connection.execute(
            "UPDATE players SET canonical_name=?, active=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (canonical_name, active, str(payload.get("notes", "")).strip(), player_id),
        )
        connection.execute(
            "INSERT INTO player_details(player_id, first_name, last_name, nickname, birth_date, nationality, preferred_foot, bio) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET "
            "first_name=excluded.first_name, last_name=excluded.last_name, nickname=excluded.nickname, "
            "birth_date=excluded.birth_date, nationality=excluded.nationality, preferred_foot=excluded.preferred_foot, "
            "bio=excluded.bio, updated_at=CURRENT_TIMESTAMP",
            (player_id, str(payload.get("firstName", "")).strip(), str(payload.get("lastName", "")).strip(),
             str(payload.get("nickname", "")).strip(), birth_date, str(payload.get("nationality", "")).strip(),
             foot, str(payload.get("bio", "")).strip()),
        )
        connection.execute("DELETE FROM player_positions WHERE player_id=?", (player_id,))
        connection.execute("INSERT INTO player_positions(player_id, position, priority) VALUES (?, ?, 1)", (player_id, primary))
        if alternate:
            connection.execute("INSERT INTO player_positions(player_id, position, priority) VALUES (?, ?, 2)", (player_id, alternate))
        if has_range:
            connection.execute(
                "INSERT INTO player_rating_ranges(player_id, min_rating, max_rating) VALUES (?, ?, ?) "
                "ON CONFLICT(player_id) DO UPDATE SET min_rating=excluded.min_rating, max_rating=excluded.max_rating, updated_at=CURRENT_TIMESTAMP",
                (player_id, minimum, maximum),
            )
        else:
            connection.execute("DELETE FROM player_rating_ranges WHERE player_id=?", (player_id,))
        connection.execute(
            "INSERT INTO audit_events(entity_type, entity_id, action, old_value, new_value, reason) "
            "VALUES ('player', ?, 'updated', ?, ?, 'Edición desde la ficha de jugador')",
            (player_id, player["canonical_name"], canonical_name),
        )
        _update_photo(connection, player_id, payload)
