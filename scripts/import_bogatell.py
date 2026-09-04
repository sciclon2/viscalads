#!/usr/bin/env python3
"""Import the curated, fully attributable Bogatell WhatsApp results.

The SQLite database is the source of truth after this one-time import. The
script is intentionally idempotent and never writes to the Sarria tournament.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect, migrate, transaction

HEAD = re.compile(r"^[\u200e\u200f]*\[(\d{2}/\d{2}/\d{4}), (\d{2}:\d{2}:\d{2})\] ([^:]+): (.*)$")
KEY_SCORE = re.compile(r"((?:\d(?:\ufe0f)?\u20e3)+)")

# date, message time, layout. Layout AB means team 1 precedes score 1 and team
# 2 is between scores; BC means scores precede their respective team lists.
RESULTS = [
    ("2023-11-18", "23:11:38", "BC"),
    ("2023-12-09", "16:03:54", "BC"),
    ("2023-12-30", "11:17:00", "BC"),
    ("2024-01-13", "23:18:52", "AB"),
    ("2024-01-20", "17:36:00", "AB"),
    ("2024-01-27", "16:35:00", "AB"),
    ("2024-03-30", "14:03:00", "BC"),
    ("2024-04-20", "16:34:00", "BC"),
    ("2024-04-27", "18:24:00", "AB"),
    ("2024-05-04", "16:31:00", "AB"),
    ("2024-05-25", "18:08:00", "BC"),
    ("2024-07-13", "11:54:00", "BC"),
    ("2024-08-10", "12:40:00", "BC"),
    ("2024-08-17", "11:16:00", "BC"),
    ("2024-09-21", "16:27:00", "AB"),
    ("2024-10-12", "16:40:00", "BC"),
    ("2024-10-19", "16:52:00", "BC"),
    ("2024-11-02", "16:15:00", "AB"),
    ("2024-11-09", "16:53:00", "BC"),
    ("2024-11-16", "17:00:00", "BC"),
    ("2025-01-04", "17:40:00", "AB"),
    ("2025-01-11", "16:51:00", "AB"),
    ("2025-01-18", "16:53:00", "AB"),
    ("2025-02-01", "16:56:00", "AB"),
    ("2025-02-08", "17:38:00", "AB"),
    ("2025-06-28", "10:27:00", "AB"),
    ("2025-08-09", "12:04:00", "AC"),
    ("2025-10-11", "18:07:00", "AB"),
    ("2025-11-01", "17:17:00", "AB"),
    ("2025-11-15", "16:47:00", "AB"),
    ("2025-12-06", "16:05:00", "BC"),
    ("2026-01-31", "17:10:00", "AB"),
    ("2026-02-14", "16:43:00", "BC"),
    ("2026-02-28", "16:51:00", "BC"),
    ("2026-07-25", "10:37:00", "BC"),
]

# Fully attributable results that use plain numerals or were posted as result
# screenshots. The WhatsApp timestamp/image name is retained as evidence.
MANUAL_GAMES = [
    ("2022-02-19", 5, 6,
     ["Pablo", "Edwin", "Facu", "Ivo", "Johann"],
     ["Andy S", "Sergio", "Edu", "Ian", "Sim", "Gus", "Gimmi"],
     "chat 17:02; unnamed/unidentified players omitted"),
    ("2023-10-07", 2, 0,
     ["Facu", "Gus", "Andy S", "Milton", "George", "Ian", "Conall", "Alex"],
     ["Edu", "André", "Pete", "Martin Rasta", "Des", "Sergio", "Johann", "Bhavin"],
     "chat 16:56-17:25; user confirmed Bogatell result"),
    ("2023-10-14", 6, 5,
     ["Edwin", "Ivo", "Andy S", "Niyi", "Gian", "Johann", "Aidan", "Gus"],
     ["Des", "André", "Pete", "Sergio", "Martin Rasta", "Facu", "Mati", "Ryan W"],
     "chat 16:49"),
    ("2023-10-21", 5, 2,
     ["Des", "Salsa", "Edwin", "Gus", "André", "Ian", "Facu", "Matías Rasta"],
     ["Edu", "Sergio", "Martin Rasta", "Aidan", "Andy S", "Ivo", "Sim", "Ryan W"],
     "chat 16:53"),
    ("2023-10-28", 4, 4,
     ["André", "Pete", "Andy S", "Des", "Edwin", "Salsa", "Sergio", "Pablo"],
     ["Milton", "Paulo", "Aidan", "Ryan W", "Facu", "Ian", "Niyi", "George"],
     "chat 16:47"),
    ("2023-11-04", 4, 5,
     ["Facu", "Andy S", "Johann", "Niyi", "Andy C", "Sergio", "Aidan", "Max"],
     ["Ryan W", "Edwin", "Gus", "Michi", "Mati", "Ian", "Salsa", "George"],
     "chat 17:24-17:54"),
    ("2025-01-25", 3, 0,
     ["Edwin", "Martin", "Des", "Ryan W", "Johann", "Mario", "Sergio", "Niyi"],
     ["Paulo", "Yoann", "Mati", "Gimmi", "Ian", "Facu", "Bhavin", "Matías Rasta"],
     "image 00015971-PHOTO-2025-01-26-15-02-32.jpg"),
    ("2025-02-22", 2, 4,
     ["Paulo", "Max", "Ryan W", "Dani"],
     ["Sim", "Gus", "Mati", "Amro", "Des", "Facu", "Ivo"],
     "image 00016369-PHOTO-2025-02-22-16-19-00.jpg"),
    ("2025-03-01", 7, 6,
     ["Paulo", "Andy S", "Amro", "André", "Ryan W", "Gimmi"],
     ["Max", "Sim", "Gus", "Ryan H", "Mati", "Ian", "Dani"],
     "image 00016509-PHOTO-2025-03-01-16-12-48.jpg"),
    ("2025-03-08", 6, 10,
     ["Paulo", "Edwin", "Gus", "Ryan H", "Mati", "Aidan", "Johann", "Dani"],
     ["Max", "Sim", "Martin", "Pete", "Gimmi", "Bhavin"],
     "image 00016630-PHOTO-2025-03-08-17-13-06.jpg"),
    ("2025-03-22", 3, 5,
     ["Paulo", "Max", "Mati", "Des", "Aidan", "Niall O"],
     ["Gus", "Yoann", "André", "Gimmi", "Johann", "Ivo", "Sergio", "Bhavin"],
     "image 00016739-PHOTO-2025-03-22-16-31-49.jpg"),
    ("2025-03-29", 8, 8,
     ["Paulo", "Max", "Gus", "Mati", "Martin", "André", "Dani"],
     ["Sim", "Yoann", "Johann"],
     "image 00016823-PHOTO-2025-03-29-17-38-34.jpg; only registered players shown"),
    ("2025-04-05", 4, 6,
     ["Sim", "Mati", "Martin", "Des", "André", "Ryan W", "Gimmi", "Mario"],
     ["Gus", "Aidan", "Johann", "Facu", "Milton", "Niyi", "Matías Rasta"],
     "image 00016924-PHOTO-2025-04-05-16-56-33.jpg"),
    ("2025-04-12", 5, 1,
     ["Max", "Sim", "Yoann", "Ryan H", "André", "Pete", "Gimmi", "Mario"],
     ["Andy S", "Mati", "Aidan", "Johann", "Niyi", "Dani", "Niall O"],
     "image 00017108-PHOTO-2025-04-12-17-22-21.jpg; unidentified Adri omitted"),
    ("2025-05-03", 2, 4,
     ["Paulo", "André", "Pete", "Aidan", "Facu", "Niall O"],
     ["Edwin", "Gus", "Amro", "Des", "Johann", "Milton", "Sergio"],
     "image 00017384-PHOTO-2025-05-03-17-18-50.jpg"),
    ("2025-06-07", 5, 5,
     ["Martin", "Ryan W", "Gimmi", "Johann", "Ian", "Niyi", "Alex"],
     ["Amro", "Aidan", "Facu", "Milton", "Sergio", "Salsa", "Niall O"],
     "image 00017740-PHOTO-2025-06-07-16-58-02.jpg and chat 16:57"),
]

# Longer/more specific spellings must come first. Unidentified guests and the
# rejected numbered Alejandro variants deliberately have no entry.
ALIASES = [
    ("Martin Rasta", r"\b(?:Martin\s+Rasta|Rasta)\b"),
    ("Matías Rasta", r"\bMat[ií]as\b"),
    ("Alejandro Solís", r"\bAle\b(?!\s*(?:II|2))"),
    ("Ryan H", r"\bRyan\s*H\b"),
    ("Ryan W", r"\b(?:Ryan\s*W|Ryan)(?!\s*H)\b"),
    ("Andy C", r"\bAndy\s*C\b"),
    ("Andy S", r"\bAndy(?:\s*S)?\b"),
    ("Sergio Pérez", r"\b(?:Sergio\s*P(?:érez)?|Pérez)\b"),
    ("Dani", r"\b(?:Dani(?:\s*(?:PY|Paraguay))?|Daniel\s+Paraguay)\b"),
    ("Johann", r"\b(?:Johann|JohanN?|Johan)\b"),
    ("Mati", r"\bMati\b"),
    ("Facu", r"\b(?:Facu|Fasu|Façu)\b"),
    ("Gimmi", r"\b(?:Gimmi|Gimmy|Gemme|Gimmy)\b"),
    ("Ian", r"\b(?:Ian|Crane|Craney)\b"),
    ("Michi", r"\b(?:Michi|Michiel)\b"),
    ("Pete", r"\b(?:Pete|Peter|Pet)\b"),
    ("Paulo", r"\bPaulo\b"),
    ("Pau", r"\bPau\b"),
    ("Yoann", r"\b(?:Yoann|Yoan)\b"),
    ("Aidan", r"\bAidan\b"), ("André", r"\b(?:André|Andre)\b"),
    ("Bhavin", r"\b(?:Bhavin|bahvin)\b"), ("Des", r"\bDes\b"),
    ("Edu", r"\bEdu\b"), ("Edwin", r"\bEdwi+n\b"),
    ("Gus", r"\bGus\b"), ("Ivo", r"\bIvo\b"),
    ("Mario", r"\bMario\b"), ("Mark", r"\bMark\b"),
    ("Martin", r"\bMart[ií]n\b"), ("Max", r"\bMax+x?\b"),
    ("Milton", r"\bMilton\b"), ("Minne", r"\b(?:Minne|Minnie)\b"),
    ("Niyi", r"\bNiyi\b"), ("Pablo", r"\bPablo\b"),
    ("Salsa", r"\bSalsa\b"), ("Sergio", r"\bSergio\b"),
    ("Sim", r"\bSim\b"), ("Tiernan", r"\bTiernan\b"),
    ("Guille", r"\b(?:Guille|Guile)\b"), ("Clement", r"\bClement\b"),
    ("George", r"\bGeorge\b"), ("Amro", r"\bAmro\b"),
    ("Alex", r"\bAlex\b"), ("Conall", r"\bConall\b"), ("Tom", r"\bTom\b"),
    ("Jaime", r"\bJaime\b"), ("Niall O", r"\bNiall(?:\s*O)?\b"),
    ("Chris", r"\bChris\b"), ("Michael", r"\bMichael\b"),
    ("Kevin", r"\bKevin\b"), ("Toni", r"\bToni\b"),
    ("Gianmaria", r"\b(?:Gianmaria|Giammaria)\b"), ("Gian", r"\bGian\b"),
]


def messages(path: Path) -> dict[tuple[str, str], str]:
    parsed: dict[tuple[str, str], str] = {}
    current = None
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = HEAD.match(line)
        if match:
            date, time, _sender, body = match.groups()
            current = (dt.datetime.strptime(date, "%d/%m/%Y").date().isoformat(), time)
            parsed[current] = body
        elif current:
            parsed[current] += "\n" + line
    return parsed


def roster(segment: str) -> list[str]:
    # Explicit guest descriptions are not player identities.
    clean = re.sub(r"(?i)\b(?:amigo|friend)\s+(?:of\s+)?[\wÀ-ɏ]+", "", segment)
    clean = re.sub(r"(?i)\bChris\s+(?:Nolan|C|2)\b", "", clean)
    clean = re.sub(r"(?i)\bInjured\s+by\b.*$", "", clean)
    if re.search(r"(?i)\bvs\b", clean):
        before, after = re.split(r"(?i)\bvs\b", clean, maxsplit=1)
        clean = before if before.strip() else after
    hits = []
    occupied: list[tuple[int, int]] = []
    for canonical, pattern in ALIASES:
        for found in re.finditer(pattern, clean, re.I):
            if any(found.start() < end and found.end() > start for start, end in occupied):
                continue
            hits.append((found.start(), canonical))
            occupied.append(found.span())
            break
    return [name for _, name in sorted(hits)]


def parse_game(body: str, layout: str) -> tuple[int, int, list[str], list[str]]:
    scores = list(KEY_SCORE.finditer(body))
    if len(scores) != 2:
        raise ValueError(f"expected two keycap scores, found {len(scores)}: {body[:100]!r}")
    chunks = [body[:scores[0].start()], body[scores[0].end():scores[1].start()], body[scores[1].end():]]
    if layout == "AB":
        team1, team2 = chunks[0], chunks[1]
    elif layout == "AC":
        team1, team2 = chunks[0], chunks[2]
    else:
        team1, team2 = chunks[1], chunks[2]
    values = [int("".join(re.findall(r"\d", score.group(1)))) for score in scores]
    return values[0], values[1], roster(team1), roster(team2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("chat", type=Path)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args()
    source = messages(args.chat)
    db = connect(args.db)
    migrate(db)
    sarria_before = db.execute(
        "SELECT COUNT(*) FROM matches m JOIN tournaments t ON t.id=m.tournament_id "
        "JOIN competitions c ON c.id=t.competition_id WHERE c.slug='sarria'"
    ).fetchone()[0]
    with transaction(db):
        bogatell_id = db.execute("SELECT id FROM competitions WHERE slug='bogatell'").fetchone()[0]
        db.execute(
            "INSERT OR IGNORE INTO tournaments(code,display_name,starts_on,competition_id) VALUES(?,?,?,?)",
            ("BOGATELL-FRIENDLIES", "Bogatell · Amistosos", RESULTS[0][0], bogatell_id),
        )
        tournament_id = db.execute("SELECT id FROM tournaments WHERE code='BOGATELL-FRIENDLIES'").fetchone()[0]
        for canonical, _ in ALIASES:
            db.execute("INSERT OR IGNORE INTO players(canonical_name) VALUES(?)", (canonical,))
        imported = 0
        for date, time_prefix, layout in RESULTS:
            matches_at_time = [
                (key, body) for key, body in source.items()
                if key[0] == date and key[1].startswith(time_prefix[:5])
                and len(list(KEY_SCORE.finditer(body))) == 2
            ]
            if not matches_at_time:
                raise ValueError(f"missing source message {date} {time_prefix}")
            key, body = matches_at_time[0]
            score1, score2, team1, team2 = parse_game(body, layout)
            if not team1 or not team2 or set(team1) & set(team2):
                raise ValueError(f"invalid teams on {date}: {team1} / {team2}")
            outcome = "D" if score1 == score2 else ("1" if score1 > score2 else "2")
            db.execute(
                "INSERT INTO matches(played_on,tournament_id,score_team1,score_team2,outcome,result_quality,coverage_status,evidence_summary,notes) "
                "VALUES(?,?,?,?,?,'exact score','verified',?,?) "
                "ON CONFLICT(played_on,tournament_id) DO UPDATE SET score_team1=excluded.score_team1,score_team2=excluded.score_team2," 
                "outcome=excluded.outcome,result_quality=excluded.result_quality,coverage_status=excluded.coverage_status,evidence_summary=excluded.evidence_summary,notes=excluded.notes",
                (date, tournament_id, score1, score2, outcome, f"WhatsApp chat {date} {key[1]}", "Invited and unidentified players excluded"),
            )
            match_id = db.execute("SELECT id FROM matches WHERE played_on=? AND tournament_id=?", (date, tournament_id)).fetchone()[0]
            db.execute("DELETE FROM match_players WHERE match_id=?", (match_id,))
            db.execute("DELETE FROM evidence WHERE match_id=?", (match_id,))
            for team_no, names in ((1, team1), (2, team2)):
                for order, name in enumerate(names, 1):
                    player_id = db.execute("SELECT id FROM players WHERE canonical_name=?", (name,)).fetchone()[0]
                    db.execute("INSERT INTO match_players(match_id,player_id,team_no,lineup_order) VALUES(?,?,?,?)", (match_id, player_id, team_no, order))
                    db.execute(
                        "INSERT OR IGNORE INTO competition_players(competition_id,player_id,joined_on) VALUES(?,?,?)",
                        (bogatell_id, player_id, date),
                    )
            db.execute(
                "INSERT INTO evidence(match_id,evidence_type,source_path,source_timestamp,excerpt,confidence) VALUES(?,?,?,?,?,'confirmed')",
                (match_id, "chat", args.chat.name, f"{date} {key[1]}", body[:1000]),
            )
            imported += 1
        for date, score1, score2, team1, team2, evidence_note in MANUAL_GAMES:
            if set(team1) & set(team2):
                raise ValueError(f"manual game has overlapping teams on {date}")
            outcome = "D" if score1 == score2 else ("1" if score1 > score2 else "2")
            db.execute(
                "INSERT INTO matches(played_on,tournament_id,score_team1,score_team2,outcome,result_quality,coverage_status,evidence_summary,notes) "
                "VALUES(?,?,?,?,?,'exact score','verified',?,?) "
                "ON CONFLICT(played_on,tournament_id) DO UPDATE SET score_team1=excluded.score_team1,score_team2=excluded.score_team2," 
                "outcome=excluded.outcome,result_quality=excluded.result_quality,coverage_status=excluded.coverage_status,evidence_summary=excluded.evidence_summary,notes=excluded.notes",
                (date, tournament_id, score1, score2, outcome, evidence_note, "Invited and unidentified players excluded"),
            )
            match_id = db.execute("SELECT id FROM matches WHERE played_on=? AND tournament_id=?", (date, tournament_id)).fetchone()[0]
            db.execute("DELETE FROM match_players WHERE match_id=?", (match_id,))
            db.execute("DELETE FROM evidence WHERE match_id=?", (match_id,))
            for team_no, names in ((1, team1), (2, team2)):
                for order, name in enumerate(names, 1):
                    db.execute("INSERT OR IGNORE INTO players(canonical_name) VALUES(?)", (name,))
                    player_id = db.execute("SELECT id FROM players WHERE canonical_name=?", (name,)).fetchone()[0]
                    db.execute("INSERT INTO match_players(match_id,player_id,team_no,lineup_order) VALUES(?,?,?,?)", (match_id, player_id, team_no, order))
                    db.execute("INSERT OR IGNORE INTO competition_players(competition_id,player_id,joined_on) VALUES(?,?,?)", (bogatell_id, player_id, date))
            evidence_type = "image" if evidence_note.startswith("image") else "chat"
            db.execute(
                "INSERT INTO evidence(match_id,evidence_type,source_path,source_timestamp,excerpt,confidence) VALUES(?,?,?,?,?,'confirmed')",
                (match_id, evidence_type, args.chat.name, date, evidence_note),
            )
            imported += 1
    sarria_after = db.execute(
        "SELECT COUNT(*) FROM matches m JOIN tournaments t ON t.id=m.tournament_id "
        "JOIN competitions c ON c.id=t.competition_id WHERE c.slug='sarria'"
    ).fetchone()[0]
    if sarria_after != sarria_before:
        raise RuntimeError(f"Sarria changed: {sarria_before} -> {sarria_after}")
    print(f"Imported {imported} verified Bogatell matches; Sarria unchanged at {sarria_after}")
    db.close()


if __name__ == "__main__":
    main()
