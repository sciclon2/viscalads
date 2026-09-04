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
        self.assertEqual([], audit(self.connection, expected_matches=124))

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
