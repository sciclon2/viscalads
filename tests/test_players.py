from __future__ import annotations

import tempfile
import unittest
import base64
from unittest.mock import patch
from pathlib import Path

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect
from sciclon2.services.players import create_player, reactivate_player_in_competition, remove_player_from_competition, update_player


class PlayerEditingTests(unittest.TestCase):
    def setUp(self):
        self.source = connect(DEFAULT_DB)
        self.temp = tempfile.TemporaryDirectory()
        self.connection = connect(Path(self.temp.name) / "players.sqlite3")
        self.source.backup(self.connection)
        self.sergio_id = self.connection.execute(
            "SELECT id FROM players WHERE canonical_name='Sergio'"
        ).fetchone()[0]

    def tearDown(self):
        self.connection.close()
        self.source.close()
        self.temp.cleanup()

    def payload(self, **overrides):
        value = {
            "name": "Sergio", "active": True, "firstName": "Sergio",
            "lastName": "Troiano", "nickname": "Pelado", "birthDate": "1982-01-14",
            "nationality": "Argentina", "preferredFoot": "Izquierda",
            "primary": "Delantero", "alternate": "Defensa por derecha",
            "bio": "", "notes": "", "ratingMin": "4", "ratingMax": "6.5",
        }
        value.update(overrides)
        return value

    def test_updates_details_positions_range_and_audit_atomically(self):
        update_player(self.connection, self.sergio_id, self.payload(nickname="Pela", ratingMax="7"))
        detail = self.connection.execute(
            "SELECT nickname FROM player_details WHERE player_id=?", (self.sergio_id,)
        ).fetchone()[0]
        positions = [row[0] for row in self.connection.execute(
            "SELECT position FROM player_positions WHERE player_id=? ORDER BY priority", (self.sergio_id,)
        )]
        rating = tuple(self.connection.execute(
            "SELECT min_rating,max_rating FROM player_rating_ranges WHERE player_id=?", (self.sergio_id,)
        ).fetchone())
        self.assertEqual("Pela", detail)
        self.assertEqual(["Delantero", "Defensa por derecha"], positions)
        self.assertEqual((4.0, 7.0), rating)
        self.assertEqual(1, self.connection.execute(
            "SELECT COUNT(*) FROM audit_events WHERE entity_type='player' AND entity_id=?", (self.sergio_id,)
        ).fetchone()[0])

    def test_rejects_invalid_range_without_partial_changes(self):
        with self.assertRaisesRegex(ValueError, "rango"):
            update_player(self.connection, self.sergio_id, self.payload(ratingMin="8", ratingMax="6"))
        self.assertEqual((4.0, 6.5), tuple(self.connection.execute(
            "SELECT min_rating,max_rating FROM player_rating_ranges WHERE player_id=?", (self.sergio_id,)
        ).fetchone()))

    def test_rejects_duplicate_positions(self):
        with self.assertRaisesRegex(ValueError, "alternativa"):
            update_player(self.connection, self.sergio_id, self.payload(alternate="Delantero"))

    def test_goalkeeper_is_a_valid_position(self):
        update_player(self.connection, self.sergio_id, self.payload(primary="Portero"))
        self.assertEqual("Portero", self.connection.execute(
            "SELECT position FROM player_positions WHERE player_id=? AND priority=1", (self.sergio_id,)
        ).fetchone()[0])

    def test_player_photo_can_be_added_and_replaced(self):
        tiny_png = b"\x89PNG\r\n\x1a\n" + b"test-image"
        payload = self.payload(photoData="data:image/png;base64," + base64.b64encode(tiny_png).decode())
        with patch("sciclon2.services.players.PHOTO_DIR", Path(self.temp.name) / "photos"):
            update_player(self.connection, self.sergio_id, payload)
        self.assertEqual(
            f"/players/player-{self.sergio_id}.png",
            self.connection.execute("SELECT photo_path FROM players WHERE id=?", (self.sergio_id,)).fetchone()[0],
        )

    def test_player_photo_rejects_unsupported_content(self):
        payload = self.payload(photoData="data:image/png;base64," + base64.b64encode(b"not-png").decode())
        with self.assertRaisesRegex(ValueError, "JPG, PNG o WebP"):
            update_player(self.connection, self.sergio_id, payload)

    def test_create_player_is_scoped_to_the_selected_competition(self):
        player_id = create_player(
            self.connection, "bogatell",
            self.payload(name="Jugador Nuevo", firstName="Jugador", lastName="Nuevo"),
        )
        memberships = [row[0] for row in self.connection.execute(
            "SELECT c.slug FROM competition_players cp JOIN competitions c ON c.id=cp.competition_id "
            "WHERE cp.player_id=? AND cp.active=1", (player_id,)
        )]
        self.assertEqual(["bogatell"], memberships)

    def test_remove_player_only_deactivates_membership_and_preserves_history(self):
        before = self.connection.execute(
            "SELECT COUNT(*) FROM match_players WHERE player_id=?", (self.sergio_id,)
        ).fetchone()[0]
        remove_player_from_competition(self.connection, self.sergio_id, "sarria")
        active = self.connection.execute(
            "SELECT cp.active FROM competition_players cp JOIN competitions c ON c.id=cp.competition_id "
            "WHERE cp.player_id=? AND c.slug='sarria'", (self.sergio_id,)
        ).fetchone()[0]
        after = self.connection.execute(
            "SELECT COUNT(*) FROM match_players WHERE player_id=?", (self.sergio_id,)
        ).fetchone()[0]
        self.assertEqual(0, active)
        self.assertEqual(before, after)
        reactivate_player_in_competition(self.connection, self.sergio_id, "sarria")
        self.assertEqual(1, self.connection.execute(
            "SELECT cp.active FROM competition_players cp JOIN competitions c ON c.id=cp.competition_id "
            "WHERE cp.player_id=? AND c.slug='sarria'", (self.sergio_id,)
        ).fetchone()[0])


if __name__ == "__main__":
    unittest.main()
