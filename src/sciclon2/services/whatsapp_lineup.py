from __future__ import annotations

import re
import random
import sqlite3
import unicodedata
from difflib import SequenceMatcher

from .rotation import consecutive_appearances, rotation_threshold


def _key(value: str) -> str:
    plain = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return " ".join(re.findall(r"[a-z0-9]+", plain.lower()))


def _visible(value: str) -> str:
    return re.sub(r"[\u200b-\u200f\u2060\ufeff]", "", value)


def _is_list_divider(line: str) -> bool:
    value = _visible(line).strip()
    return len(value) >= 3 and not re.search(r"[A-Za-zÀ-ÿ0-9]", value) and bool(re.fullmatch(r"[-–—_ .]+", value))


def _name_from_line(line: str) -> str:
    value = _visible(line).strip()
    value = re.sub(r"^[>\s]+", "", value)
    value = re.sub(r"^\s*[-*•✅☑️✔️]+\s*", "", value)
    value = re.sub(r"^\d+(?:\ufe0f?\u20e3)?\s*[.)°º:\-]?\s*", "", value)
    value = re.sub(r"^\s*(?:\[?\s*i\s*n\s*\]?|\(?\s*i\s*n\s*\)?)\s*[-–—:|]*\s*", "", value, flags=re.I)
    value = re.sub(r"^@", "", value)
    previous = None
    while previous != value:
        previous = value
        value = re.sub(
            r"(?:\s+|[-–—,:|]+\s*)(?:\(?\s*i\s*n\s*\)?|\[\s*i\s*n\s*\]|confirmad[oa]|✅|☑️|✔️|⚽|🔥)\s*$",
            "",
            value,
            flags=re.I,
        )
    return value.strip(" *_~`-–—:.,")


def _slot_number(line: str) -> int | None:
    match = re.match(r"^[>\s*•-]*(\d+)(?:\ufe0f?\u20e3)?\s*[.)°º:\-]?", _visible(line))
    return int(match.group(1)) if match else None


def _is_confirmed(line: str) -> bool:
    return bool(re.search(r"(?:^|[\s*_[\]()]|[-–—:|])i\s*n(?:$|[\s*_[\]()]|[-–—:|])", line, re.I) or
                re.search(r"✅|☑️|✔️|confirmad[oa]", line, re.I))


def _declared_capacity(text: str) -> tuple[int | None, bool]:
    plain = _key(text)
    final = re.search(r"\bfinal\s+(\d+)\b", plain)
    if final:
        return int(final.group(1)), True
    sided = re.search(r"\b(\d+)\s*(?:a side|por lado)\b", plain)
    if sided:
        return int(sided.group(1)) * 2, False
    versus = re.search(r"\b(\d+)\s*(?:vs|v)\s*\1\b", plain)
    if versus:
        return int(versus.group(1)) * 2, False
    players = re.search(r"\b(?:cupo|jugamos|convocados|final)\D{0,12}(\d+)\s+jugadores\b", plain)
    return (int(players.group(1)), False) if players else (None, False)


def _apply_rotation(items: list[dict], streaks: dict[int, int], threshold: int = 2) -> list[dict]:
    """Swap eligible reserves into a full list using the competition rotation rule.

    Reserves enter in source-list order. On matchday two, a reserve with no
    appearances may replace an opening-day player. From matchday three onward,
    the normal threshold is two consecutive appearances. The longest streak
    leaves first; an exact tie within the same streak is decided randomly.
    """
    entrants = [
        item for item in items
        if item["status"] == "reserve"
        and _is_confirmed(item["raw"])
        and item["playerId"] is not None
        and streaks.get(int(item["playerId"]), 0) < threshold
    ]
    outgoing = [
        item for item in items
        if item["accepted"]
        and item["playerId"] is not None
        and streaks.get(int(item["playerId"]), 0) >= threshold
    ]
    by_streak: dict[int, list[dict]] = {}
    for item in outgoing:
        by_streak.setdefault(streaks.get(int(item["playerId"]), 0), []).append(item)
    outgoing = []
    randomly_tied_ids: set[int] = set()
    rng = random.SystemRandom()
    for streak in sorted(by_streak, reverse=True):
        group = by_streak[streak]
        if len(group) > 1:
            rng.shuffle(group)
            randomly_tied_ids.update(int(item["playerId"]) for item in group)
        outgoing.extend(group)
    displaced: list[dict] = []
    for entrant, leaving in zip(entrants, outgoing):
        entrant["accepted"] = True
        entrant["status"] = "rotated_in"
        entrant["consecutiveAppearances"] = streaks.get(int(entrant["playerId"]), 0)
        entrant["replacesPlayerId"] = leaving["playerId"]
        entrant["replacesPlayer"] = leaving["player"]
        entrant["tieBreakRandom"] = int(leaving["playerId"]) in randomly_tied_ids
        entrant["rotationReason"] = (
            f'{entrant["player"]} entra por estar primero entre los suplentes con IN '
            f'y llevar {entrant["consecutiveAppearances"]} partidos consecutivos. '
            f'{leaving["player"]} cede el lugar después de '
            f'{streaks.get(int(leaving["playerId"]), 0)} partidos consecutivos.'
            + (' Se aplica la excepción de la fecha 2 para repartir la oportunidad de jugar.'
               if threshold == 1 else '')
            + (' Como había jugadores empatados con esa misma racha, la salida se decidió por sorteo.'
               if entrant["tieBreakRandom"] else '')
        )
        leaving["accepted"] = False
        leaving["status"] = "rotated_out"
        leaving["consecutiveAppearances"] = streaks.get(int(leaving["playerId"]), 0)
        leaving["replacedByPlayerId"] = entrant["playerId"]
        leaving["replacedByPlayer"] = entrant["player"]
        leaving["tieBreakRandom"] = entrant["tieBreakRandom"]
        leaving["rotationReason"] = entrant["rotationReason"]
        displaced.append(leaving)
    waiting_groups: dict[int, list[dict]] = {}
    for item in displaced:
        waiting_groups.setdefault(item["consecutiveAppearances"], []).append(item)
    waiting_order = 0
    for streak in sorted(waiting_groups):
        group = waiting_groups[streak]
        if len(group) > 1:
            rng.shuffle(group)
        for item in group:
            item["waitingOrder"] = waiting_order
            waiting_order += 1
    return items


def _fill_open_slots(items: list[dict], capacity: int | None, streaks: dict[int, int]) -> int:
    """Promote confirmed reserves into vacant places before applying rotation."""
    if capacity is None:
        return 0
    accepted_count = sum((1 + item["guestCount"]) for item in items if item["accepted"])
    open_slots = max(0, capacity - accepted_count)
    filled = 0
    for item in items:
        if open_slots <= 0:
            break
        places = 1 + item["guestCount"]
        if (
            item["status"] == "reserve"
            and item.get("confirmed")
            and item["playerId"] is not None
            and places <= open_slots
        ):
            item["accepted"] = True
            item["status"] = "promoted_in"
            item["consecutiveAppearances"] = streaks.get(int(item["playerId"]), 0)
            item["promotionReason"] = (
                f'{item["player"]} entra por estar primero entre los suplentes con IN '
                "y haber un lugar libre en la convocatoria."
            )
            open_slots -= places
            filled += places
    return filled


def _whatsapp_list(items: list[dict], capacity: int | None) -> str:
    if capacity is None:
        return ""
    entrants = {item.get("replacesPlayerId"): item for item in items if item["status"] == "rotated_in"}
    starters: list[str] = []
    for item in items:
        if item.get("originalReserve"):
            continue
        if item["status"] == "rotated_out":
            replacement = entrants.get(item.get("playerId"))
            if replacement and replacement.get("player"):
                starters.append(f'{replacement["player"]} IN')
        elif item.get("accepted") and item.get("player"):
            starters.append(f'{item["player"]} IN')
    starters.extend(
        f'{item["player"]} IN'
        for item in items
        if item["status"] == "promoted_in" and item.get("player")
    )

    original_reserves = [
        item for item in items
        if item.get("originalReserve") and item["status"] not in {"rotated_in", "promoted_in"}
    ]
    displaced = sorted(
        (item for item in items if item["status"] == "rotated_out"),
        key=lambda item: item.get("waitingOrder", 10_000),
    )

    def label(item: dict) -> str:
        name = item.get("player") or item.get("value") or item.get("raw") or "Jugador"
        return f'{name}{" IN" if item.get("confirmed") else ""}'

    reserves = [label(item) for item in original_reserves] + [label(item) for item in displaced]
    lines = ["Titulares", *(f"{index}. {name}" for index, name in enumerate(starters, 1))]
    if reserves:
        lines.extend(["", "Suplentes", *(f"{index}. {name}" for index, name in enumerate(reserves, 1))])
    return "\n".join(lines)


def parse_whatsapp_lineup(connection: sqlite3.Connection, competition: str, text: str) -> dict:
    """Resolve a pasted WhatsApp list using canonical names and stored aliases."""
    if not text.strip():
        raise ValueError("Pegá una lista de WhatsApp")
    players = connection.execute(
        "SELECT p.id, p.canonical_name FROM competition_players cp "
        "JOIN competitions c ON c.id=cp.competition_id "
        "JOIN players p ON p.id=cp.player_id "
        "WHERE c.slug=? AND cp.active=1 AND p.active=1 ORDER BY p.canonical_name",
        (competition,),
    ).fetchall()
    if not players:
        raise ValueError("La competencia no tiene jugadores activos")
    by_id = {int(row["id"]): row["canonical_name"] for row in players}
    lookup: dict[str, set[int]] = {}
    for player_id, name in by_id.items():
        lookup.setdefault(_key(name), set()).add(player_id)
    for row in connection.execute(
        "SELECT pa.player_id, pa.alias FROM player_aliases pa "
        "JOIN competition_players cp ON cp.player_id=pa.player_id "
        "JOIN competitions c ON c.id=cp.competition_id "
        "WHERE c.slug=? AND cp.active=1",
        (competition,),
    ):
        if int(row["player_id"]) in by_id:
            lookup.setdefault(_key(row["alias"]), set()).add(int(row["player_id"]))

    lines = text.splitlines()
    capacity, _final_list = _declared_capacity(text)
    reserve_at = next((index for index, line in enumerate(lines)
                       if _is_list_divider(line) or any(
                           word in _key(line) for word in ("suplentes", "reservas", "lista de espera")
                       )), None)
    if capacity is None and reserve_at is not None:
        slots = [_slot_number(line) for line in lines[:reserve_at]]
        capacity = max((slot for slot in slots if slot is not None), default=None)
    structured = capacity is not None or reserve_at is not None
    ignored_words = {"lista", "equipo", "equipos", "convocados", "miercoles", "sabado", "titulares"}
    items = []
    seen: set[int] = set()
    reserve_section = False
    for raw in lines:
        if _is_list_divider(raw):
            reserve_section = True
            continue
        if _declared_capacity(raw)[0] is not None:
            continue
        if re.match(r"^\s*\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b", raw) or re.search(r"\b\d{1,2}(?:[:.]\d{2})?\s*(?:hs|h)\b", raw, re.I):
            continue
        slot = _slot_number(raw)
        confirmed = _is_confirmed(raw)
        value = _name_from_line(raw)
        guest_match = re.search(r"\+\s*(\d+)", value)
        guest_count = int(guest_match.group(1)) if guest_match else 0
        value = re.sub(r"\s*\+\s*\d+\s*", " ", value).strip()
        key = _key(value)
        if not key:
            continue
        if any(word in key for word in ("suplentes", "reservas", "lista de espera")):
            reserve_section = True
            continue
        if any(word in key for word in ("titulares", "lista final", "convocados")):
            reserve_section = False
            continue
        if key in ignored_words or key.startswith(("lista ", "equipo ", "partido ", "miercoles ", "sabado ", "convocatoria ", "nuevo torneo", "amistoso ", "septiembre ")):
            continue
        if re.match(r"^(?:primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo) partido\b", key):
            continue
        if key in {"reina elizenda", "reina elisenda", "sarria", "bogatell", "barceloneta"}:
            continue
        if re.fullmatch(r"(?:cerrad[ao]|completa|completo|hora|lugar|fecha)(?:\s+.*)?", key):
            continue
        outside_capacity = reserve_section or (capacity is not None and slot is not None and slot > capacity)
        explicitly_out = bool(re.search(r"(?:^|\s)(?:out|baja|no voy|no juega)(?:\s|$)", key))
        if explicitly_out:
            cleaned = re.sub(r"(?:^|\s)(?:out|baja|no voy|no juega)(?:\s|$)", " ", key).strip()
            items.append({"raw": raw.strip(), "value": cleaned or value, "status": "excluded",
                          "playerId": None, "player": None, "candidates": [],
                          "accepted": False, "confirmed": False, "slot": slot, "guestCount": guest_count,
                          "originalReserve": outside_capacity})
            continue
        accepted = not outside_capacity and confirmed
        exact = sorted(lookup.get(key, set()))
        if len(exact) == 1:
            player_id = exact[0]
            status = "reserve" if outside_capacity else ("unconfirmed" if not accepted else ("duplicate" if player_id in seen else "matched"))
            if accepted:
                seen.add(player_id)
            items.append({"raw": raw.strip(), "value": value, "status": status,
                          "playerId": player_id, "player": by_id[player_id], "candidates": [],
                          "accepted": accepted and status != "duplicate", "confirmed": confirmed, "slot": slot,
                          "guestCount": guest_count, "originalReserve": outside_capacity})
            continue
        scores: dict[int, float] = {}
        for candidate_key, player_ids in lookup.items():
            score = SequenceMatcher(None, key, candidate_key).ratio()
            for player_id in player_ids:
                scores[player_id] = max(scores.get(player_id, 0), score)
        candidates = [
            {"playerId": player_id, "player": by_id[player_id], "score": round(score, 3)}
            for player_id, score in sorted(scores.items(), key=lambda item: (-item[1], by_id[item[0]].lower()))[:3]
            if score >= 0.5
        ]
        status = "reserve" if outside_capacity else ("ambiguous" if candidates else "unknown")
        items.append({"raw": raw.strip(), "value": value, "status": status,
                      "playerId": None, "player": None, "candidates": candidates,
                      "accepted": accepted, "confirmed": confirmed, "slot": slot, "guestCount": guest_count,
                      "originalReserve": outside_capacity})
    streaks = consecutive_appearances(connection, competition)
    threshold = rotation_threshold(connection, competition)
    filled_vacancies = _fill_open_slots(items, capacity, streaks)
    accepted_before_rotation = sum((1 + item["guestCount"]) for item in items if item["accepted"])
    if capacity is not None and accepted_before_rotation == capacity:
        _apply_rotation(items, streaks, threshold)
    for item in items:
        if item["playerId"] is not None:
            item.setdefault("consecutiveAppearances", streaks.get(int(item["playerId"]), 0))
    accepted_count = sum((1 + item["guestCount"]) for item in items if item["accepted"])
    return {
        "items": items,
        "matched": sum(item["status"] == "matched" for item in items),
        "needsReview": sum(item["status"] in {"ambiguous", "unknown", "duplicate"} for item in items),
        "capacity": capacity,
        "acceptedCount": accepted_count,
        "waitingCount": sum(
            item["status"] in {"reserve", "rotated_out"}
            and item.get("confirmed")
            and item["playerId"] is not None
            for item in items
        ),
        "filledVacancies": filled_vacancies,
        "rotationChanges": sum(item["status"] == "rotated_in" for item in items),
        "rotationThreshold": threshold,
        "complete": capacity is not None and accepted_count == capacity,
        "whatsappText": _whatsapp_list(items, capacity),
    }
