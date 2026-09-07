from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect, migrate
from sciclon2.services.tournaments import create_tournament, list_tournaments
from sciclon2.services.match_entry import _tournament_id


class TournamentTests(unittest.TestCase):
    def setUp(self):
        self.source = connect(DEFAULT_DB)
        self.temp = tempfile.TemporaryDirectory()
        self.connection = connect(Path(self.temp.name) / "tournaments.sqlite3")
        self.source.backup(self.connection)
        migrate(self.connection)

    def tearDown(self):
        self.connection.close()
        self.source.close()
        self.temp.cleanup()

    def test_list_is_scoped_and_includes_history(self):
        items = list_tournaments(self.connection, "sarria")
        self.assertTrue(items)
        self.assertTrue(all(item["code"] != "BOGATELL-FRIENDLIES" for item in items))
        self.assertTrue(any(item["matchCount"] > 0 for item in items))

    def test_create_is_scoped_audited_and_visible(self):
        item_id = create_tournament(self.connection, "sarria", {
            "displayName": "Torneo de prueba", "startsOn": "2027-01-10", "matchdayCount": 10,
        })
        created = next(item for item in list_tournaments(self.connection, "sarria") if item["id"] == item_id)
        self.assertEqual("Torneo de prueba", created["displayName"])
        self.assertEqual(10, created["matchdayCount"])
        self.assertEqual("2027-03-14", created["endsOn"])
        self.assertEqual(0, created["matchCount"])
        self.assertFalse(any(item["id"] == item_id for item in list_tournaments(self.connection, "bogatell")))
        self.assertEqual(1, self.connection.execute(
            "SELECT COUNT(*) FROM audit_events WHERE entity_type='tournament' AND entity_id=?", (item_id,)
        ).fetchone()[0])

    def test_rejects_duplicate_name_and_invalid_dates(self):
        payload = {"displayName": "Torneo único", "startsOn": "2027-01-10", "matchdayCount": 10}
        create_tournament(self.connection, "sarria", payload)
        with self.assertRaisesRegex(ValueError, "Ya existe"):
            create_tournament(self.connection, "sarria", payload)
        with self.assertRaisesRegex(ValueError, "cantidad"):
            create_tournament(self.connection, "sarria", {
                "displayName": "Fechas malas", "startsOn": "2027-02-01", "matchdayCount": 0,
            })

    def test_explicit_tournament_must_belong_to_competition(self):
        sarria_id = self.connection.execute("SELECT id FROM competitions WHERE slug='sarria'").fetchone()[0]
        bogatell_tournament = self.connection.execute(
            "SELECT t.id FROM tournaments t JOIN competitions c ON c.id=t.competition_id WHERE c.slug='bogatell' LIMIT 1"
        ).fetchone()[0]
        with self.assertRaisesRegex(ValueError, "no pertenece"):
            _tournament_id(self.connection, sarria_id, "2026-09-02", bogatell_tournament)


if __name__ == "__main__":
    unittest.main()
