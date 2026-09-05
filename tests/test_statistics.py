from __future__ import annotations

import unittest

from sciclon2.services.statistics import build_statistics


def game(
    team1: list[str],
    team2: list[str],
    outcome: str,
    *,
    tournament: str = "Liga 1",
    coverage: str = "verified",
) -> dict:
    """Small, explicit fixture for testing the statistics query contract."""
    return {
        "team1": team1,
        "team2": team2,
        "outcome": outcome,
        "tournament": tournament,
        "coverage_status": coverage,
    }


def by_name(rows: list[dict]) -> dict[str, dict]:
    return {row["name"]: row for row in rows}


class StatisticsQueryTests(unittest.TestCase):
    def setUp(self):
        self.games = [
            game(["Ana", "Beto", "Cami"], ["Dani", "Eva", "Fede"], "1"),
            game(["Ana", "Dani", "Eva"], ["Beto", "Cami", "Fede"], "D"),
            game(
                ["Ana", "Beto", "Fede"],
                ["Cami", "Dani", "Eva"],
                "2",
                tournament="Liga 2",
            ),
        ]
        self.stats = build_statistics(self.games)

    def test_individual_results_are_counted_from_the_players_side(self):
        players = by_name(self.stats["players"])
        self.assertEqual(
            {"name": "Ana", "played": 3, "wins": 1, "draws": 1, "losses": 1},
            players["Ana"],
        )
        self.assertEqual(
            {"name": "Dani", "played": 3, "wins": 1, "draws": 1, "losses": 1},
            players["Dani"],
        )

    def test_points_can_be_derived_as_three_per_win_and_one_per_draw(self):
        players = by_name(self.stats["players"])
        points = {
            name: row["wins"] * 3 + row["draws"] for name, row in players.items()
        }
        self.assertEqual(4, points["Ana"])
        self.assertEqual(4, points["Dani"])

    def test_tournament_queries_are_isolated(self):
        league_1 = by_name(self.stats["tournaments"]["Liga 1"])
        league_2 = by_name(self.stats["tournaments"]["Liga 2"])
        self.assertEqual((2, 1, 1, 0), tuple(league_1["Ana"][key] for key in ("played", "wins", "draws", "losses")))
        self.assertEqual((1, 0, 0, 1), tuple(league_2["Ana"][key] for key in ("played", "wins", "draws", "losses")))

    def test_pair_statistics_follow_shared_team_results(self):
        pairs = {tuple(row["name"]): row for row in self.stats["pairs"]}
        self.assertEqual(
            {"name": ["Ana", "Beto"], "played": 2, "wins": 1, "draws": 0, "losses": 1},
            pairs[("Ana", "Beto")],
        )
        self.assertEqual(1, pairs[("Ana", "Dani")]["draws"])

    def test_trio_statistics_follow_shared_team_results(self):
        trios = {tuple(row["name"]): row for row in self.stats["trios"]}
        self.assertEqual(
            {"name": ["Ana", "Beto", "Cami"], "played": 1, "wins": 1, "draws": 0, "losses": 0},
            trios[("Ana", "Beto", "Cami")],
        )

    def test_unverified_matches_do_not_affect_any_query(self):
        baseline = build_statistics(self.games)
        with_partial = build_statistics(
            self.games + [game(["Ana", "Beto"], ["Cami", "Dani"], "1", coverage="partial")]
        )
        self.assertEqual(baseline, with_partial)

    def test_large_sides_count_for_players_but_not_combinations(self):
        team1 = [f"A{index}" for index in range(9)]
        team2 = [f"B{index}" for index in range(9)]
        stats = build_statistics([game(team1, team2, "1")])
        self.assertEqual(18, len(stats["players"]))
        self.assertEqual([], stats["pairs"])
        self.assertEqual([], stats["trios"])

    def test_output_is_stable_when_there_are_no_games(self):
        self.assertEqual(
            {"players": [], "tournaments": {}, "pairs": [], "trios": []},
            build_statistics([]),
        )


if __name__ == "__main__":
    unittest.main()
