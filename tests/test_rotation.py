from __future__ import annotations

import sqlite3
import unittest

from sciclon2.services.rotation import consecutive_appearances, rotation_threshold


class RotationTests(unittest.TestCase):
    def setUp(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript("""
            CREATE TABLE competitions (id INTEGER PRIMARY KEY, slug TEXT);
            CREATE TABLE tournaments (id INTEGER PRIMARY KEY, competition_id INTEGER, starts_on TEXT);
            CREATE TABLE matches (
                id INTEGER PRIMARY KEY, played_on TEXT, outcome TEXT,
                coverage_status TEXT, voided_at TEXT, tournament_id INTEGER
            );
            CREATE TABLE match_players (match_id INTEGER, player_id INTEGER, team_no INTEGER);
            INSERT INTO competitions VALUES (1, 'sarria'), (2, 'bogatell');
            INSERT INTO tournaments VALUES
                (1, 1, '2025-09-01'), (2, 1, '2026-01-01'), (3, 2, '2026-01-01');
        """)

    def add_match(self, match_id: int, played_on: str, tournament_id: int, players: list[int]):
        self.connection.execute(
            "INSERT INTO matches VALUES (?,?,'1','verified',NULL,?)",
            (match_id, played_on, tournament_id),
        )
        for player_id in players:
            self.connection.execute(
                "INSERT INTO match_players VALUES (?,?,1)", (match_id, player_id),
            )

    def test_new_tournament_resets_every_streak(self):
        self.add_match(1, '2026-01-01', 1, [1, 2])
        self.add_match(2, '2026-01-08', 1, [1])
        self.add_match(3, '2026-01-15', 2, [1, 2])
        self.assertEqual({1: 1, 2: 1}, consecutive_appearances(self.connection, 'sarria'))

    def test_empty_new_tournament_starts_everyone_at_zero(self):
        self.connection.execute("INSERT INTO tournaments VALUES (4, 1, '2026-02-01')")
        self.assertEqual({}, consecutive_appearances(self.connection, 'sarria'))

    def test_sarria_and_bogatell_never_mix(self):
        self.add_match(1, '2026-01-01', 2, [1])
        self.add_match(2, '2026-01-02', 3, [2])
        self.assertEqual({1: 1}, consecutive_appearances(self.connection, 'sarria'))
        self.assertEqual({2: 1}, consecutive_appearances(self.connection, 'bogatell'))

    def test_second_matchday_uses_one_appearance_threshold(self):
        self.add_match(1, '2026-01-15', 2, [1, 2])
        self.assertEqual(1, rotation_threshold(self.connection, 'sarria'))

    def test_third_matchday_restores_two_appearance_threshold(self):
        self.add_match(1, '2026-01-15', 2, [1, 2])
        self.add_match(2, '2026-01-22', 2, [1])
        self.assertEqual(2, rotation_threshold(self.connection, 'sarria'))


if __name__ == '__main__':
    unittest.main()
