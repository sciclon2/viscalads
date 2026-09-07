from __future__ import annotations

import sqlite3
import unittest
from datetime import date

from sciclon2.services.ratings import player_ratings


class RatingTests(unittest.TestCase):
    def setUp(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript("""
            CREATE TABLE players (id INTEGER PRIMARY KEY);
            CREATE TABLE player_rating_ranges (player_id INTEGER PRIMARY KEY, min_rating REAL, max_rating REAL);
            CREATE TABLE competitions (id INTEGER PRIMARY KEY, slug TEXT);
            CREATE TABLE tournaments (id INTEGER PRIMARY KEY, competition_id INTEGER);
            CREATE TABLE matches (id INTEGER PRIMARY KEY, played_on TEXT, outcome TEXT, coverage_status TEXT, tournament_id INTEGER);
            CREATE TABLE match_players (match_id INTEGER, player_id INTEGER, team_no INTEGER);
            INSERT INTO players VALUES (1);
            INSERT INTO player_rating_ranges VALUES (1, 4.0, 6.5);
            INSERT INTO competitions VALUES (1, 'sarria'), (2, 'bogatell');
            INSERT INTO tournaments VALUES (1, 1), (2, 2);
        """)

    def tearDown(self):
        self.connection.close()

    def add(self, match_id: int, played_on: str, outcome: str, team_no: int = 1):
        self.connection.execute("INSERT INTO matches VALUES (?, ?, ?, 'verified', 1)", (match_id, played_on, outcome))
        self.connection.execute("INSERT INTO match_players VALUES (?, 1, ?)", (match_id, team_no))

    def test_fewer_than_five_recent_matches_use_midpoint(self):
        for index in range(4):
            self.add(index + 1, f"2026-08-{20 + index:02d}", "1")
        rating = player_ratings(self.connection, date(2026, 9, 6))[1]
        self.assertEqual(5.25, rating["current"])
        self.assertFalse(rating["dynamic"])

    def test_five_wins_pad_to_ten_with_neutral_results(self):
        for index in range(5):
            self.add(index + 1, f"2026-08-{20 + index:02d}", "1")
        rating = player_ratings(self.connection, date(2026, 9, 6))[1]
        self.assertEqual(6.12, rating["current"])
        self.assertEqual(5, rating["recentMatches"])
        self.assertTrue(rating["dynamic"])

    def test_old_matches_are_excluded(self):
        for index in range(5):
            self.add(index + 1, f"2026-05-{20 + index:02d}", "1")
        rating = player_ratings(self.connection, date(2026, 9, 6))[1]
        self.assertEqual(0, rating["recentMatches"])
        self.assertEqual(5.25, rating["current"])

    def test_matches_between_sixty_and_ninety_days_are_included(self):
        for index in range(5):
            self.add(index + 1, f"2026-06-{10 + index:02d}", "1")
        rating = player_ratings(self.connection, date(2026, 9, 6), "sarria")[1]
        self.assertEqual(5, rating["recentMatches"])
        self.assertTrue(rating["dynamic"])

    def test_only_latest_ten_matches_are_used(self):
        for index in range(12):
            outcome = "2" if index < 2 else "1"
            self.add(index + 1, f"2026-08-{index + 1:02d}", outcome)
        rating = player_ratings(self.connection, date(2026, 9, 6))[1]
        self.assertEqual(6.5, rating["current"])
        self.assertEqual(10, rating["recentMatches"])

    def test_opponent_strength_does_not_change_match_weight(self):
        self.connection.execute("INSERT INTO players VALUES (2)")
        self.connection.execute("INSERT INTO player_rating_ranges VALUES (2, 1.0, 3.0)")
        for index in range(5):
            self.add(index + 1, f"2026-08-{20 + index:02d}", "1")
            self.connection.execute(
                "INSERT INTO match_players VALUES (?, 2, 2)", (index + 1,)
            )
        rating = player_ratings(self.connection, date(2026, 9, 6))[1]
        self.assertTrue(rating["dynamic"])
        self.assertEqual(0.85, rating["formScore"])
        self.assertEqual(6.12, rating["current"])

    def test_competitions_are_never_mixed(self):
        for index in range(5):
            self.add(index + 1, f"2026-08-{20 + index:02d}", "1")
        for index in range(5, 10):
            self.add(index + 1, f"2026-08-{20 + index:02d}", "2")
            self.connection.execute(
                "UPDATE matches SET tournament_id=2 WHERE id=?", (index + 1,)
            )
        sarria = player_ratings(self.connection, date(2026, 9, 6), "sarria")[1]
        bogatell = player_ratings(self.connection, date(2026, 9, 6), "bogatell")[1]
        self.assertGreater(sarria["current"], sarria["midpoint"])
        self.assertLess(bogatell["current"], bogatell["midpoint"])


if __name__ == "__main__":
    unittest.main()
