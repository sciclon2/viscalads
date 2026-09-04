from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect
from sciclon2.services.audit import audit
from sciclon2.services.export import web_payload


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.source = connect(DEFAULT_DB)
        self.temp = tempfile.TemporaryDirectory()
        self.connection = connect(Path(self.temp.name) / "test.sqlite3")
        self.source.backup(self.connection)

    def tearDown(self):
        self.connection.close()
        self.source.close()
        self.temp.cleanup()

    def test_database_audit(self):
        self.assertEqual([], audit(self.connection, expected_matches=126))

    def test_2026_external_reconciliation(self):
        march = self.connection.execute(
            "SELECT score_team1, score_team2, outcome FROM matches WHERE played_on='2026-03-25'"
        ).fetchone()
        self.assertEqual((3, 3, "D"), tuple(march))

        august = self.connection.execute(
            "SELECT score_team1, score_team2, outcome FROM matches WHERE played_on='2026-08-26'"
        ).fetchone()
        self.assertEqual((5, 10, "2"), tuple(august))

        july = self.connection.execute(
            "SELECT score_team1, score_team2 FROM matches WHERE played_on='2026-07-29'"
        ).fetchone()
        self.assertEqual((6, 11), tuple(july))
        self.assertIsNone(self.connection.execute(
            "SELECT id FROM matches WHERE played_on='2026-07-31'"
        ).fetchone())

    def test_corrected_player_assignments(self):
        july = dict(self.connection.execute(
            "SELECT p.canonical_name, mp.team_no FROM match_players mp "
            "JOIN players p ON p.id=mp.player_id JOIN matches m ON m.id=mp.match_id "
            "WHERE m.played_on='2026-07-15' AND p.canonical_name IN ('Pau','Sergio Pérez')"
        ).fetchall())
        self.assertEqual({"Pau": 1, "Sergio Pérez": 2}, july)

        august = [row[0] for row in self.connection.execute(
            "SELECT p.canonical_name FROM match_players mp "
            "JOIN players p ON p.id=mp.player_id JOIN matches m ON m.id=mp.match_id "
            "WHERE m.played_on='2026-08-05' AND p.canonical_name IN ('Sergio','Sergio Pérez')"
        )]
        self.assertEqual(["Sergio"], august)

    def test_all_2026_matches_have_exact_scores(self):
        missing = self.connection.execute(
            "SELECT played_on FROM matches WHERE played_on >= '2026-01-01' "
            "AND (score_team1 IS NULL OR score_team2 IS NULL)"
        ).fetchall()
        self.assertEqual([], missing)

    def test_web_payload_is_derived_from_database(self):
        payload = web_payload(self.connection)
        match_count = self.connection.execute("SELECT count(*) FROM matches").fetchone()[0]
        self.assertEqual(match_count, len(payload["games"]))
        self.assertEqual("data/sciclon2.sqlite3", payload["generatedFrom"])

    def test_all_player_totals_balance(self):
        for player in web_payload(self.connection)["players"]:
            self.assertEqual(
                player["played"],
                player["wins"] + player["draws"] + player["losses"],
                player["name"],
            )

    def test_foreign_keys_are_enabled(self):
        self.assertEqual(1, self.connection.execute("PRAGMA foreign_keys").fetchone()[0])


if __name__ == "__main__":
    unittest.main()
