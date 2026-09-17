from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect
from sciclon2.services.match_entry import recent_lineups, save_lineup, save_match, void_match


class MatchEntryWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.source = connect(DEFAULT_DB)
        self.temp = tempfile.TemporaryDirectory()
        self.connection = connect(Path(self.temp.name) / "test.sqlite3")
        self.source.backup(self.connection)
        self.players = [row[0] for row in self.connection.execute(
            "SELECT p.id FROM players p JOIN competition_players cp ON cp.player_id=p.id "
            "JOIN competitions c ON c.id=cp.competition_id "
            "WHERE c.slug='bogatell' AND cp.active=1 ORDER BY p.id LIMIT 4"
        )]

    def tearDown(self):
        self.connection.close()
        self.source.close()
        self.temp.cleanup()

    def payload(self) -> dict:
        return {
            "competition": "bogatell",
            "playedOn": "2030-01-05",
            "teams": [
                [{"playerId": self.players[0]}, {"playerId": self.players[1]}],
                [{"playerId": self.players[2]}, {"guestName": "Invitado 1"}],
            ],
            "goals": [
                {"teamNo": 1, "playerId": self.players[0], "count": 2},
                {"teamNo": 2, "guestName": "Invitado 1", "count": 1},
                {"teamNo": 2, "count": 1},
            ],
        }

    def test_create_derives_draw_and_persists_rosters_and_known_scorers(self):
        match_id = save_match(self.connection, self.payload())
        match = self.connection.execute(
            "SELECT score_team1, score_team2, outcome FROM matches WHERE id=?", (match_id,)
        ).fetchone()
        self.assertEqual((2, 2, "D"), tuple(match))
        self.assertEqual(3, self.connection.execute(
            "SELECT COUNT(*) FROM match_players WHERE match_id=?", (match_id,)
        ).fetchone()[0])
        self.assertEqual(1, self.connection.execute(
            "SELECT COUNT(*) FROM match_guests WHERE match_id=?", (match_id,)
        ).fetchone()[0])
        # The anonymous goal contributes to the score but deliberately has no scorer row.
        self.assertEqual(2, self.connection.execute(
            "SELECT COUNT(*) FROM match_goals WHERE match_id=?", (match_id,)
        ).fetchone()[0])

    def test_guest_goals_count_for_score_but_never_for_a_player(self):
        payload = self.payload()
        payload["goals"] = [{"teamNo": 2, "guestName": "Invitado 1", "count": 3}]
        match_id = save_match(self.connection, payload)
        goal = self.connection.execute(
            "SELECT player_id, guest_id, goal_count FROM match_goals WHERE match_id=?",
            (match_id,),
        ).fetchone()
        self.assertIsNone(goal["player_id"])
        self.assertIsNotNone(goal["guest_id"])
        self.assertEqual(3, goal["goal_count"])
        score = self.connection.execute(
            "SELECT score_team1, score_team2 FROM matches WHERE id=?", (match_id,)
        ).fetchone()
        self.assertEqual((0, 3), tuple(score))

    def test_update_replaces_old_rosters_and_recalculates_the_result(self):
        match_id = save_match(self.connection, self.payload())
        update = {
            "competition": "bogatell",
            "playedOn": "2030-01-12",
            "teams": [[{"playerId": self.players[0]}], [{"playerId": self.players[3]}]],
            "goals": [{"teamNo": 2, "playerId": self.players[3], "count": 3}],
        }
        save_match(self.connection, update, match_id)
        row = self.connection.execute(
            "SELECT played_on, score_team1, score_team2, outcome FROM matches WHERE id=?", (match_id,)
        ).fetchone()
        self.assertEqual(("2030-01-12", 0, 3, "2"), tuple(row))
        roster = [row[0] for row in self.connection.execute(
            "SELECT player_id FROM match_players WHERE match_id=? ORDER BY team_no", (match_id,)
        )]
        self.assertEqual([self.players[0], self.players[3]], roster)

    def test_duplicate_player_is_rejected_atomically(self):
        payload = self.payload()
        payload["teams"][1][0] = {"playerId": self.players[0]}
        before = self.connection.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
        with self.assertRaisesRegex(ValueError, "dos equipos"):
            save_match(self.connection, payload)
        self.assertEqual(before, self.connection.execute("SELECT COUNT(*) FROM matches").fetchone()[0])

    def test_duplicate_match_has_a_friendly_error_and_is_not_saved_twice(self):
        save_match(self.connection, self.payload())
        before = self.connection.execute("SELECT COUNT(*) FROM matches").fetchone()[0]

        with self.assertRaisesRegex(ValueError, "ya fue guardado"):
            save_match(self.connection, self.payload())

        self.assertEqual(before, self.connection.execute("SELECT COUNT(*) FROM matches").fetchone()[0])

    def test_scorer_must_belong_to_the_indicated_team(self):
        payload = self.payload()
        payload["goals"] = [{"teamNo": 2, "playerId": self.players[0], "count": 1}]
        with self.assertRaisesRegex(ValueError, "goleador"):
            save_match(self.connection, payload)

    def test_players_cannot_cross_competition_boundaries(self):
        sarria_only = self.connection.execute(
            "SELECT cp.player_id FROM competition_players cp "
            "JOIN competitions c ON c.id=cp.competition_id WHERE c.slug='sarria' "
            "AND NOT EXISTS (SELECT 1 FROM competition_players other "
            "JOIN competitions oc ON oc.id=other.competition_id "
            "WHERE other.player_id=cp.player_id AND oc.slug='bogatell') LIMIT 1"
        ).fetchone()[0]
        payload = self.payload()
        payload["teams"][0][0] = {"playerId": sarria_only}
        with self.assertRaisesRegex(ValueError, "no pertenecen"):
            save_match(self.connection, payload)

    def test_recent_lineups_are_scoped_ordered_and_limited(self):
        sarria_before = recent_lineups(self.connection, "sarria")
        for index in range(6):
            lineup_id = save_lineup(
                self.connection,
                "bogatell",
                [[self.players[index % 2]], [self.players[2 + index % 2]]],
            )
        lineups = recent_lineups(self.connection, "bogatell")
        self.assertEqual(5, len(lineups))
        self.assertEqual(lineup_id, lineups[0]["id"])
        self.assertEqual(sarria_before, recent_lineups(self.connection, "sarria"))

    def test_recent_lineup_preserves_temporary_guests(self):
        lineup_id = save_lineup(self.connection, "bogatell", [
            [{"playerId": self.players[0]}, {"guestName": "Invitado 1", "level": 6.5, "position": "Portero"}],
            [{"playerId": self.players[1]}],
        ])
        lineup = recent_lineups(self.connection, "bogatell")[0]
        self.assertEqual(lineup_id, lineup["id"])
        self.assertEqual("Invitado 1", lineup["guest1"][0]["guest_label"])
        self.assertEqual(6.5, lineup["guest1"][0]["level"])
        self.assertEqual("Portero", lineup["guest1"][0]["primary_position"])

    def test_void_is_audited_and_cannot_be_repeated(self):
        match_id = save_match(self.connection, self.payload())
        void_match(self.connection, match_id, "Dato duplicado")
        row = self.connection.execute(
            "SELECT voided_at, void_reason FROM matches WHERE id=?", (match_id,)
        ).fetchone()
        self.assertIsNotNone(row[0])
        self.assertEqual("Dato duplicado", row[1])
        action = self.connection.execute(
            "SELECT action FROM audit_events WHERE entity_type='match' AND entity_id=? "
            "ORDER BY id DESC LIMIT 1", (match_id,)
        ).fetchone()[0]
        self.assertEqual("voided", action)
        with self.assertRaisesRegex(ValueError, "ya está anulado"):
            void_match(self.connection, match_id, "Otra vez")


if __name__ == "__main__":
    unittest.main()
