from __future__ import annotations

import unittest

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect
from sciclon2.services.achievements import GOAL_LEVELS, NEMESIS_LEVELS, PARTNERSHIP_LEVELS, PRIME_LEVELS, STREAK_LEVELS, _level, player_achievements
from sciclon2.services.tournaments import calculated_tournament_champions


class AchievementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.connection = connect(DEFAULT_DB)
        cls.achievements = player_achievements(cls.connection, "sarria")

    @classmethod
    def tearDownClass(cls):
        cls.connection.close()

    def test_levels_return_the_highest_threshold_reached(self):
        self.assertIsNone(_level(4, STREAK_LEVELS))
        self.assertEqual((5, "Bronce"), _level(6, STREAK_LEVELS))
        self.assertEqual((7, "Plata"), _level(9, STREAK_LEVELS))
        self.assertEqual((10, "Oro"), _level(10, STREAK_LEVELS))
        self.assertEqual((10, "Bronce"), _level(19, PARTNERSHIP_LEVELS))
        self.assertEqual((20, "Plata"), _level(29, PARTNERSHIP_LEVELS))
        self.assertEqual((30, "Oro"), _level(30, PARTNERSHIP_LEVELS))
        self.assertEqual((5, "Bronce"), _level(6, NEMESIS_LEVELS))
        self.assertEqual((7, "Plata"), _level(9, NEMESIS_LEVELS))
        self.assertEqual((10, "Oro"), _level(10, NEMESIS_LEVELS))
        self.assertEqual((5, "Bronce"), _level(6, PRIME_LEVELS))
        self.assertEqual((7, "Plata"), _level(9, PRIME_LEVELS))
        self.assertEqual((10, "Oro"), _level(10, PRIME_LEVELS))
        self.assertEqual((100, "Legendario"), _level(125, GOAL_LEVELS))

    def test_debut_patch_is_not_emitted(self):
        self.assertFalse(any(patch["code"] == "debut" for patches in self.achievements.values() for patch in patches))

    def test_veteran_requires_at_least_sixty_verified_matches(self):
        for player_id, patches in self.achievements.items():
            veteran = next((patch for patch in patches if patch["code"] == "veteran"), None)
            played = self.connection.execute(
                "SELECT COUNT(*) FROM match_players mp JOIN matches m ON m.id=mp.match_id "
                "JOIN tournaments t ON t.id=m.tournament_id JOIN competitions c ON c.id=t.competition_id "
                "WHERE mp.player_id=? AND c.slug='sarria' AND m.voided_at IS NULL AND m.coverage_status='verified' "
                "AND m.outcome IN ('1','2','D')", (player_id,),
            ).fetchone()[0]
            self.assertEqual(played >= 60, veteran is not None)

    def test_prime_sustained_and_nemesis_never_unlock_below_their_thresholds(self):
        for patches in self.achievements.values():
            for patch in patches:
                if patch["code"] == "prime_streak":
                    self.assertGreaterEqual(patch["progress"], 5)
                    expected = "Bronce" if patch["progress"] < 7 else "Plata" if patch["progress"] < 10 else "Oro"
                    self.assertEqual(expected, patch["level"])
                if patch["code"] == "nemesis":
                    self.assertGreaterEqual(patch["progress"], 5)
                    expected = "Bronce" if patch["progress"] < 7 else "Plata" if patch["progress"] < 10 else "Oro"
                    self.assertEqual(expected, patch["level"])
                if patch["code"] == "partnership":
                    expected = "Bronce" if patch["progress"] < 20 else "Plata" if patch["progress"] < 30 else "Oro"
                    self.assertEqual(expected, patch["level"])

    def test_period_achievements_include_a_valid_date_range(self):
        period_codes = {"veteran", "centenary", "winning_streak", "unbeaten", "always_present", "partnership", "nemesis", "prime_streak"}
        for patches in self.achievements.values():
            for patch in patches:
                self.assertIn("earnedFrom", patch)
                if patch["code"] in period_codes:
                    self.assertIsNotNone(patch["earnedFrom"])
                    self.assertLessEqual(patch["earnedFrom"], patch["earnedAt"])

    def test_removed_wall_patch_is_never_emitted(self):
        self.assertFalse(any(patch["code"] == "wall" for patches in self.achievements.values() for patch in patches))

    def test_champion_patch_lists_every_title_and_uses_one_two_three_tiers(self):
        for player_id, patches in self.achievements.items():
            champion = next((patch for patch in patches if patch["code"] == "champion"), None)
            player_name = self.connection.execute("SELECT canonical_name FROM players WHERE id=?", (player_id,)).fetchone()[0]
            title_count = sum(
                player_name in calculated_tournament_champions(self.connection, tournament[0])
                for tournament in self.connection.execute(
                    "SELECT t.id FROM tournaments t JOIN competitions c ON c.id=t.competition_id WHERE c.slug='sarria'"
                )
            )
            if not champion:
                self.assertEqual(0, title_count)
                continue
            expected = "Bronce" if title_count == 1 else "Plata" if title_count == 2 else "Oro"
            self.assertEqual(expected, champion["level"])
            self.assertEqual(title_count, champion["progress"])
            self.assertNotIn("legend", {patch["code"] for patch in patches})

    def test_unbeaten_champion_has_a_title_and_no_tournament_losses(self):
        for player_id, patches in self.achievements.items():
            patch = next((item for item in patches if item["code"] == "unbeaten_champion"), None)
            if not patch:
                continue
            player_name = self.connection.execute(
                "SELECT canonical_name FROM players WHERE id=?", (player_id,)
            ).fetchone()[0]
            undefeated_titles = 0
            for tournament in self.connection.execute(
                "SELECT t.id FROM tournaments t JOIN competitions c ON c.id=t.competition_id WHERE c.slug='sarria'"
            ):
                if player_name not in calculated_tournament_champions(self.connection, tournament["id"]):
                    continue
                rows = self.connection.execute(
                    "SELECT m.outcome,mp.team_no FROM matches m JOIN match_players mp ON mp.match_id=m.id "
                    "WHERE m.tournament_id=? AND mp.player_id=? AND m.voided_at IS NULL "
                    "AND m.coverage_status='verified' AND m.outcome IN ('1','2','D')",
                    (tournament["id"], player_id),
                ).fetchall()
                if rows and all(row["outcome"] == "D" or row["outcome"] == str(row["team_no"]) for row in rows):
                    undefeated_titles += 1
            self.assertEqual(undefeated_titles, patch["progress"])

    def test_competition_histories_never_mix(self):
        sarria = player_achievements(self.connection, "sarria")
        bogatell = player_achievements(self.connection, "bogatell")
        for player_id, patches in sarria.items():
            played = self.connection.execute(
                "SELECT COUNT(*) FROM match_players mp JOIN matches m ON m.id=mp.match_id "
                "JOIN tournaments t ON t.id=m.tournament_id JOIN competitions c ON c.id=t.competition_id "
                "WHERE mp.player_id=? AND c.slug='sarria' AND m.voided_at IS NULL "
                "AND m.coverage_status='verified' AND m.outcome IN ('1','2','D')", (player_id,),
            ).fetchone()[0]
            self.assertEqual(played >= 100, any(patch["code"] == "centenary" for patch in patches))
        self.assertNotEqual(sarria, bogatell)


if __name__ == "__main__":
    unittest.main()
