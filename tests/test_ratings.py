from __future__ import annotations

import sqlite3
import unittest
from datetime import date

from sciclon2.services.ratings import player_rating_history, player_ratings


class RatingTests(unittest.TestCase):
    def setUp(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript("""
            CREATE TABLE players (id INTEGER PRIMARY KEY);
            CREATE TABLE player_rating_ranges (player_id INTEGER PRIMARY KEY, min_rating REAL, max_rating REAL);
            CREATE TABLE competitions (id INTEGER PRIMARY KEY, slug TEXT);
            CREATE TABLE tournaments (id INTEGER PRIMARY KEY, competition_id INTEGER, code TEXT);
            CREATE TABLE matches (id INTEGER PRIMARY KEY, played_on TEXT, outcome TEXT, coverage_status TEXT, tournament_id INTEGER, score_team1 INTEGER, score_team2 INTEGER, voided_at TEXT);
            CREATE TABLE match_players (match_id INTEGER, player_id INTEGER, team_no INTEGER);
            INSERT INTO players VALUES (1);
            INSERT INTO player_rating_ranges VALUES (1, 4.0, 6.5);
            INSERT INTO competitions VALUES (1, 'sarria'), (2, 'bogatell');
            INSERT INTO tournaments VALUES (1, 1, 'T1'), (2, 2, 'B1');
        """)

    def tearDown(self):
        self.connection.close()

    def add(self, match_id: int, played_on: str, outcome: str, team_no: int = 1):
        self.connection.execute(
            "INSERT INTO matches(id, played_on, outcome, coverage_status, tournament_id) VALUES (?, ?, ?, 'verified', 1)",
            (match_id, played_on, outcome),
        )
        self.connection.execute("INSERT INTO match_players VALUES (?, 1, ?)", (match_id, team_no))

    def add_absence(self, match_id: int, played_on: str):
        self.connection.execute(
            "INSERT INTO matches(id, played_on, outcome, coverage_status, tournament_id) VALUES (?, ?, '1', 'verified', 1)",
            (match_id, played_on),
        )

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

    def test_matches_older_than_ninety_five_days_remain_when_playing_is_continuous(self):
        for index, played_on in enumerate(("2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01")):
            self.add(index + 1, played_on, "1")
        rating = player_ratings(self.connection, date(2026, 6, 20))[1]
        self.assertEqual(5, rating["recentMatches"])
        self.assertTrue(rating["dynamic"])
        self.assertEqual(6.12, rating["current"])

    def test_rating_stays_stable_until_inactivity_limit(self):
        for index in range(5):
            self.add(index + 1, f"2025-05-{20 + index:02d}", "1")
        original = player_ratings(self.connection, date(2025, 6, 1), "sarria")[1]
        ninety_five_days_later = player_ratings(self.connection, date(2025, 8, 27), "sarria")[1]
        self.assertEqual(original["current"], ninety_five_days_later["current"])
        self.assertFalse(ninety_five_days_later["stale"])

    def test_rating_becomes_stale_after_more_than_ninety_five_days_without_playing(self):
        for index in range(5):
            self.add(index + 1, f"2025-05-{20 + index:02d}", "1")
        stale = player_ratings(self.connection, date(2025, 8, 28), "sarria")[1]
        self.assertTrue(stale["stale"])
        self.assertFalse(stale["dynamic"])
        self.assertEqual(5, stale["recentMatches"])
        self.assertEqual(6.12, stale["current"])
        self.assertEqual(stale["midpoint"], stale["matchmakingCurrent"])

    def test_return_after_long_gap_starts_a_new_spell(self):
        for index in range(5):
            self.add(index + 1, f"2025-05-{20 + index:02d}", "1")
        self.add(6, "2026-01-10", "1")
        returned = player_ratings(self.connection, date(2026, 1, 10), "sarria")[1]
        self.assertFalse(returned["stale"])
        self.assertFalse(returned["dynamic"])
        self.assertEqual(1, returned["recentMatches"])
        self.assertEqual(returned["midpoint"], returned["current"])

    def test_three_consecutive_absences_reduce_form_by_ten_percentage_points(self):
        for index in range(5):
            self.add(index + 1, f"2026-08-{10 + index:02d}", "1")
        for index in range(3):
            self.add_absence(index + 10, f"2026-08-{20 + index:02d}")
        rating = player_ratings(self.connection, date(2026, 9, 6), "sarria")[1]
        self.assertTrue(rating["absencePenalty"])
        self.assertEqual(3, rating["missedMatches"])
        self.assertEqual(10, rating["absencePenaltyPercent"])
        self.assertEqual(0.75, rating["formScore"])
        self.assertEqual(5.88, rating["current"])

    def test_two_consecutive_absences_do_not_apply_penalty(self):
        for index in range(5):
            self.add(index + 1, f"2026-08-{10 + index:02d}", "1")
        for index in range(2):
            self.add_absence(index + 10, f"2026-08-{20 + index:02d}")
        rating = player_ratings(self.connection, date(2026, 9, 6), "sarria")[1]
        self.assertFalse(rating["absencePenalty"])
        self.assertEqual(2, rating["missedMatches"])
        self.assertEqual(0.85, rating["formScore"])

    def test_only_latest_ten_matches_are_used(self):
        for index in range(12):
            outcome = "2" if index < 2 else "1"
            self.add(index + 1, f"2026-08-{index + 1:02d}", outcome)
        rating = player_ratings(self.connection, date(2026, 9, 6))[1]
        self.assertEqual(6.5, rating["current"])
        self.assertEqual(10, rating["recentMatches"])

    def test_a_new_win_never_lowers_the_rating(self):
        outcomes = ["1", "1", "2", "1", "1", "1", "2", "1", "1", "1"]
        for index, outcome in enumerate(outcomes):
            self.add(index + 1, f"2026-08-{index + 1:02d}", outcome)
        before = player_ratings(self.connection, date(2026, 8, 10), "sarria")[1]
        self.add(11, "2026-08-11", "1")
        after = player_ratings(self.connection, date(2026, 8, 11), "sarria")[1]
        self.assertGreaterEqual(after["formScore"], before["formScore"])

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

    def test_history_recalculates_each_matchday_without_future_results(self):
        for index in range(5):
            self.add(index + 1, f"2026-08-{10 + index:02d}", "1")
        history = player_rating_history(self.connection, "sarria")[1]
        self.assertEqual(5, len(history))
        self.assertEqual(5.25, history[0]["current"])
        self.assertEqual(6.12, history[-1]["current"])
        self.assertEqual("W", history[-1]["result"])
        self.assertTrue(history[-1]["participated"])

    def test_history_includes_absent_matchdays_after_first_appearance(self):
        self.add(1, "2026-08-10", "1")
        self.add_absence(2, "2026-08-17")
        history = player_rating_history(self.connection, "sarria")[1]
        self.assertEqual(2, len(history))
        self.assertFalse(history[-1]["participated"])
        self.assertIsNone(history[-1]["result"])
        self.assertEqual(1, history[-1]["missedMatches"])

    def test_history_does_not_draw_a_player_before_their_debut(self):
        self.add_absence(1, "2026-08-03")
        self.add(2, "2026-08-10", "1")
        history = player_rating_history(self.connection, "sarria")[1]
        self.assertEqual(["2026-08-10"], [point["date"] for point in history])


if __name__ == "__main__":
    unittest.main()
