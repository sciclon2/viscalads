from __future__ import annotations

import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect, migrate
from sciclon2.services.tournaments import (
    calculated_tournament_champions,
    create_tournament,
    list_tournaments,
    tournament_standings,
)
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

    def test_sarria_champions_are_calculated_and_match_historical_audit_data(self):
        for tournament_id in range(1, 10):
            historical = sorted(row[0] for row in self.connection.execute(
                "SELECT p.canonical_name FROM tournament_champions tc "
                "JOIN players p ON p.id=tc.player_id WHERE tc.tournament_id=?",
                (tournament_id,),
            ))
            self.assertEqual(historical, calculated_tournament_champions(self.connection, tournament_id))

    def test_every_tournament_has_an_explicit_closing_date(self):
        missing = self.connection.execute(
            "SELECT COUNT(*) FROM tournaments WHERE ends_on IS NULL OR trim(ends_on)=''"
        ).fetchone()[0]
        self.assertEqual(0, missing)
        latest = self.connection.execute(
            "SELECT ends_on FROM tournaments WHERE code='T10 Jun-Sep26'"
        ).fetchone()
        self.assertIsNotNone(latest)
        self.assertEqual('2026-09-02', latest['ends_on'])

    def test_open_tournament_exposes_leaders_but_not_champions(self):
        open_tournament = self.connection.execute(
            "SELECT id FROM tournaments WHERE code='SARRIA-11' AND ends_on>=?",
            (date.today().isoformat(),),
        ).fetchone()
        self.assertIsNotNone(open_tournament)
        self.assertTrue(calculated_tournament_champions(self.connection, open_tournament["id"]))
        listed = next(
            item for item in list_tournaments(self.connection, "sarria")
            if item["id"] == open_tournament["id"]
        )
        self.assertEqual([], listed["champions"])

    def test_visible_champion_does_not_depend_on_historical_snapshot(self):
        tournament_id = 2
        expected = calculated_tournament_champions(self.connection, tournament_id)
        self.connection.execute("DELETE FROM tournament_champions WHERE tournament_id=?", (tournament_id,))
        listed = next(item for item in list_tournaments(self.connection, "sarria") if item["id"] == tournament_id)
        self.assertEqual(expected, listed["champions"])

    def test_create_is_scoped_audited_and_visible(self):
        item_id = create_tournament(self.connection, "sarria", {
            "displayName": "Torneo de prueba", "startsOn": "2027-01-10", "matchdayCount": 10,
            "goalMarginPenalty": True,
        })
        created = next(item for item in list_tournaments(self.connection, "sarria") if item["id"] == item_id)
        self.assertEqual("Torneo de prueba", created["displayName"])
        self.assertEqual(10, created["matchdayCount"])
        self.assertEqual("2027-03-14", created["endsOn"])
        self.assertEqual(0, created["matchCount"])
        self.assertEqual("goal_margin_loss", created["rules"][0]["code"])
        self.assertEqual(-1, created["rules"][0]["pointsDelta"])
        self.assertFalse(any(item["id"] == item_id for item in list_tournaments(self.connection, "bogatell")))
        self.assertEqual(1, self.connection.execute(
            "SELECT COUNT(*) FROM audit_events WHERE entity_type='tournament' AND entity_id=?", (item_id,)
        ).fetchone()[0])

    def test_open_standings_include_only_recent_active_players_who_have_not_played(self):
        tournament_id = create_tournament(self.connection, "sarria", {
            "displayName": "Torneo todavía vacío", "startsOn": "2027-03-01",
            "matchdayCount": 4, "ruleCode": "none",
        })
        latest_match = self.connection.execute(
            "SELECT MAX(m.played_on) FROM matches m JOIN tournaments t ON t.id=m.tournament_id "
            "JOIN competitions c ON c.id=t.competition_id "
            "WHERE c.slug='sarria' AND m.voided_at IS NULL AND m.coverage_status='verified'"
        ).fetchone()[0]
        cutoff = (date.fromisoformat(latest_match) - timedelta(days=90)).isoformat()
        recent_players = self.connection.execute(
            "SELECT COUNT(DISTINCT cp.player_id) FROM competition_players cp "
            "JOIN competitions c ON c.id=cp.competition_id "
            "JOIN match_players mp ON mp.player_id=cp.player_id "
            "JOIN matches m ON m.id=mp.match_id JOIN tournaments t ON t.id=m.tournament_id "
            "WHERE c.slug='sarria' AND cp.active=1 AND t.competition_id=c.id "
            "AND m.voided_at IS NULL AND m.coverage_status='verified' AND m.played_on>=?",
            (cutoff,),
        ).fetchone()[0]

        table = tournament_standings(self.connection, tournament_id)

        self.assertEqual(recent_players, len(table))
        self.assertTrue(all(
            row["played"] == 0 and row["totalPoints"] == 0 for row in table
        ))
        self.assertEqual([], calculated_tournament_champions(self.connection, tournament_id))

    def test_closed_standings_keep_only_that_tournament_participants(self):
        tournament_id = self.connection.execute(
            "SELECT id FROM tournaments WHERE code='T1 Oct23-Feb24'"
        ).fetchone()[0]
        table = tournament_standings(self.connection, tournament_id)
        participants = self.connection.execute(
            "SELECT COUNT(DISTINCT mp.player_id) FROM match_players mp "
            "JOIN matches m ON m.id=mp.match_id WHERE m.tournament_id=? AND m.voided_at IS NULL",
            (tournament_id,),
        ).fetchone()[0]
        self.assertEqual(participants, len(table))

    def test_wide_loss_penalty_is_tournament_only_and_can_go_negative(self):
        tournament_id = create_tournament(self.connection, "sarria", {
            "displayName": "Torneo con castigo", "startsOn": "2027-04-01",
            "matchdayCount": 5, "goalMarginPenalty": True,
        })
        players = self.connection.execute(
            "SELECT id, canonical_name FROM players ORDER BY id LIMIT 2"
        ).fetchall()
        match_id = self.connection.execute(
            "INSERT INTO matches(played_on,tournament_id,score_team1,score_team2,outcome,result_quality,coverage_status) "
            "VALUES ('2027-04-01',?,1,5,'2','exact score','verified')", (tournament_id,)
        ).lastrowid
        self.connection.execute(
            "INSERT INTO match_players(match_id,player_id,team_no,lineup_order) VALUES (?,?,1,1)",
            (match_id, players[0]["id"]),
        )
        self.connection.execute(
            "INSERT INTO match_players(match_id,player_id,team_no,lineup_order) VALUES (?,?,2,1)",
            (match_id, players[1]["id"]),
        )
        table = {row["name"]: row for row in tournament_standings(self.connection, tournament_id)}
        loser = table[players[0]["canonical_name"]]
        winner = table[players[1]["canonical_name"]]
        self.assertEqual(-1, loser["totalPoints"])
        self.assertEqual(1, loser["penalizedMatches"])
        self.assertEqual(-1, loser["negativePoints"])
        self.assertEqual(3, winner["totalPoints"])

    def test_rules_cannot_be_changed_after_creation(self):
        tournament_id = create_tournament(self.connection, "sarria", {
            "displayName": "Reglas cerradas", "startsOn": "2027-06-01",
            "matchdayCount": 4, "goalMarginPenalty": True,
        })
        with self.assertRaisesRegex(Exception, "inmutables"):
            self.connection.execute(
                "UPDATE tournament_rules SET points_delta=-2 WHERE tournament_id=?", (tournament_id,)
            )

    def test_cumulative_margin_rule_rewards_and_penalizes_each_band(self):
        tournament_id = create_tournament(self.connection, "sarria", {
            "displayName": "Regla acumulativa", "startsOn": "2027-05-01",
            "matchdayCount": 2, "ruleCode": "goal_margin_both",
        })
        players = self.connection.execute("SELECT id, canonical_name FROM players ORDER BY id LIMIT 2").fetchall()
        match_id = self.connection.execute(
            "INSERT INTO matches(played_on,tournament_id,score_team1,score_team2,outcome,result_quality,coverage_status) "
            "VALUES ('2027-05-01',?,7,1,'1','exact score','verified')", (tournament_id,)
        ).lastrowid
        for team_no, player in enumerate(players, 1):
            self.connection.execute(
                "INSERT INTO match_players(match_id,player_id,team_no,lineup_order) VALUES (?,?,?,1)",
                (match_id, player["id"], team_no),
            )
        table = {row["name"]: row for row in tournament_standings(self.connection, tournament_id)}
        winner, loser = table[players[0]["canonical_name"]], table[players[1]["canonical_name"]]
        self.assertEqual(5, winner["totalPoints"])
        self.assertEqual(2, winner["positivePoints"])
        self.assertEqual(-2, loser["totalPoints"])
        self.assertEqual(-2, loser["negativePoints"])

    def test_rule_code_can_create_a_tournament_without_special_rules(self):
        item_id = create_tournament(self.connection, "sarria", {
            "displayName": "Sin regla", "startsOn": "2027-07-01",
            "matchdayCount": 4, "ruleCode": "none",
        })
        created = next(item for item in list_tournaments(self.connection, "sarria") if item["id"] == item_id)
        self.assertEqual([], created["rules"])

    def test_unknown_rule_code_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Regla de torneo no válida"):
            create_tournament(self.connection, "sarria", {
                "displayName": "Regla inventada", "startsOn": "2027-08-01",
                "matchdayCount": 4, "ruleCode": "future_rule",
            })

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
