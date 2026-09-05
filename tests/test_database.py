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
        self.assertEqual([], audit(self.connection, expected_matches=177))

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
        self.assertEqual(["sarria", "bogatell"], [item["slug"] for item in payload["competitions"]])
        self.assertEqual(126, len(payload["competitionStats"]["sarria"]["games"]))
        self.assertEqual(51, len(payload["competitionStats"]["bogatell"]["games"]))

    def test_competition_histories_are_isolated(self):
        counts = dict(self.connection.execute(
            "SELECT c.slug, COUNT(m.id) FROM competitions c "
            "LEFT JOIN tournaments t ON t.competition_id=c.id "
            "LEFT JOIN matches m ON m.tournament_id=t.id GROUP BY c.slug"
        ).fetchall())
        self.assertEqual({"sarria": 126, "bogatell": 51}, counts)
        wrong_weekday = self.connection.execute(
            "SELECT m.played_on FROM matches m JOIN tournaments t ON t.id=m.tournament_id "
            "JOIN competitions c ON c.id=t.competition_id "
            "WHERE c.slug='bogatell' AND strftime('%w', m.played_on) != '6'"
        ).fetchall()
        self.assertEqual([], wrong_weekday)

    def test_every_tournament_belongs_to_a_competition(self):
        missing = self.connection.execute(
            "SELECT code FROM tournaments WHERE competition_id IS NULL"
        ).fetchall()
        self.assertEqual([], missing)

    def test_players_are_global_and_memberships_are_scoped(self):
        duplicate_names = self.connection.execute(
            "SELECT canonical_name FROM players GROUP BY canonical_name COLLATE NOCASE HAVING COUNT(*) > 1"
        ).fetchall()
        self.assertEqual([], duplicate_names)
        invalid = self.connection.execute(
            "SELECT cp.player_id FROM competition_players cp "
            "LEFT JOIN players p ON p.id=cp.player_id "
            "LEFT JOIN competitions c ON c.id=cp.competition_id "
            "WHERE p.id IS NULL OR c.id IS NULL"
        ).fetchall()
        self.assertEqual([], invalid)
        self.assertGreater(
            self.connection.execute(
                "SELECT COUNT(*) FROM competition_players cp "
                "JOIN competitions c ON c.id=cp.competition_id WHERE c.slug='sarria'"
            ).fetchone()[0],
            0,
        )

    def test_profiles_expose_competition_memberships(self):
        payload = web_payload(self.connection)
        self.assertTrue(all("competitions" in profile for profile in payload["profiles"]))
        self.assertTrue(any("sarria" in profile["competitions"] for profile in payload["profiles"]))

    def test_player_photos_are_local_or_empty(self):
        payload = web_payload(self.connection)
        for profile in payload["profiles"]:
            self.assertTrue(not profile["photo"] or profile["photo"].startswith("/players/"))

    def test_sergio_profile_details_come_from_database(self):
        profile = next(p for p in web_payload(self.connection)["profiles"] if p["name"] == "Sergio")
        self.assertEqual("Sergio", profile["firstName"])
        self.assertEqual("Troiano", profile["lastName"])
        self.assertEqual("Pelado", profile["nickname"])
        self.assertEqual("1982-01-14", profile["birthDate"])
        self.assertEqual("Argentina", profile["nationality"])
        self.assertEqual("Izquierda", profile["preferredFoot"])

    def test_official_and_alternate_venues_are_scoped(self):
        payload = web_payload(self.connection)
        sarria = payload["competitionStats"]["sarria"]["venues"]
        bogatell = payload["competitionStats"]["bogatell"]["venues"]

        self.assertEqual([("Col·legi Sagrat Cor de Sarrià", "primary")],
                         [(venue["display_name"], venue["role"]) for venue in sarria])
        self.assertEqual(
            [("CEM Bogatell", "primary"),
             ("Camp de Futbol Municipal Parc de la Catalana", "alternate")],
            [(venue["display_name"], venue["role"]) for venue in bogatell],
        )
        self.assertTrue(all(venue["maps_url"].startswith("https://www.google.com/maps/")
                            for venue in sarria + bogatell))
        bogatell_photo = next(
            photo for photo in bogatell[0]["photos"]
            if photo["taken_on"] == "2021-07-02"
        )
        self.assertEqual("/venues/bogatell-2021-07-02.png", bogatell_photo["image_url"])
        self.assertEqual("team", bogatell_photo["photo_type"])

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
