from __future__ import annotations

import sqlite3
import unittest
from unittest.mock import patch

from sciclon2.services.whatsapp_lineup import parse_whatsapp_lineup


class WhatsAppLineupTests(unittest.TestCase):
    def setUp(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript("""
            CREATE TABLE players (id INTEGER PRIMARY KEY, canonical_name TEXT, active INTEGER);
            CREATE TABLE competitions (id INTEGER PRIMARY KEY, slug TEXT);
            CREATE TABLE competition_players (competition_id INTEGER, player_id INTEGER, active INTEGER);
            CREATE TABLE player_aliases (player_id INTEGER, alias TEXT);
            CREATE TABLE tournaments (id INTEGER PRIMARY KEY, competition_id INTEGER, starts_on TEXT);
            CREATE TABLE matches (id INTEGER PRIMARY KEY, tournament_id INTEGER, played_on TEXT, voided_at TEXT, coverage_status TEXT, outcome TEXT);
            CREATE TABLE match_players (match_id INTEGER, player_id INTEGER);
            INSERT INTO players VALUES (1,'Facu',1),(2,'Sergio',1),(3,'Sergio Pérez',1),(4,'Mati',1),(5,'Andy S',1),(6,'Bhavin',1);
            INSERT INTO competitions VALUES (1,'sarria'),(2,'bogatell');
            INSERT INTO competition_players VALUES (1,1,1),(1,2,1),(1,3,1),(2,4,1),(1,5,1),(1,6,1);
            INSERT INTO player_aliases VALUES (1,'Fasu'),(2,'Pelado'),(4,'Matias Sentous');
            INSERT INTO tournaments VALUES (1,1,'2026-09-01');
        """)

    def add_recent_matches(self, appearances):
        for match_id, player_ids in enumerate(appearances, 1):
            self.connection.execute(
                "INSERT INTO matches VALUES (?,?,?,NULL,'verified','1')",
                (match_id, 1, f'2026-09-{8 - match_id:02d}'),
            )
            self.connection.executemany(
                "INSERT INTO match_players VALUES (?,?)",
                [(match_id, player_id) for player_id in player_ids],
            )

    def test_resolves_numbers_in_markers_accents_and_aliases(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'LISTA\n1. Fasu IN\n2) Pelado ✅')
        self.assertEqual(['Facu', 'Sergio'], [item['player'] for item in result['items']])
        self.assertEqual(2, result['matched'])

    def test_returns_ranked_options_instead_of_guessing(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'Sergo')
        item = result['items'][0]
        self.assertEqual('ambiguous', item['status'])
        self.assertGreaterEqual(len(item['candidates']), 1)

    def test_never_uses_players_from_another_competition(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'Matias Sentous')
        self.assertEqual('unknown', result['items'][0]['status'])

    def test_duplicate_is_flagged(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'Facu IN\nFasu IN')
        self.assertEqual('duplicate', result['items'][1]['status'])

    def test_supports_emoji_numbers_parenthesized_in_and_mentions(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', '1️⃣ @Facu (IN)\n2 Sergio ✅ IN')
        self.assertEqual(['Facu', 'Sergio'], [item['player'] for item in result['items']])

    def test_reserves_and_explicit_out_players_are_not_selected(self):
        result = parse_whatsapp_lineup(
            self.connection, 'sarria', 'Titulares\nFacu IN\nSUPLENTES\nSergio\nSergio Pérez OUT',
        )
        self.assertEqual(['matched', 'reserve', 'excluded'], [item['status'] for item in result['items']])

    def test_ignores_descriptive_headers(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'Lista miércoles 20 hs\n1. Facu')
        self.assertEqual(1, len(result['items']))
        self.assertEqual('Facu', result['items'][0]['player'])

    def test_in_is_case_insensitive_before_or_after_the_name(self):
        variants = ['Facu IN', 'Facu in', 'Facu In', 'iN - Facu', '[IN] Facu']
        for variant in variants:
            with self.subTest(variant=variant):
                result = parse_whatsapp_lineup(self.connection, 'sarria', variant)
                self.assertEqual('Facu', result['items'][0]['player'])

    def test_spaced_in_is_accepted_without_truncating_names_ending_in_in(self):
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'Segundo Partido T11 Miércoles 23/09/2026\n'
            '1. Andy S I N\n2. Bhavin IN\n3. I N - Sergio Pérez',
        )
        self.assertEqual(['Andy S', 'Bhavin', 'Sergio Pérez'], [item['player'] for item in result['items']])
        self.assertEqual(['matched', 'matched', 'matched'], [item['status'] for item in result['items']])

    def test_strips_whatsapp_markdown_quotes_and_status_symbols(self):
        text = '> 1) *Facu* ✅\n2. _Pelado_ - confirmado\n• `Sergio Pérez` ☑️'
        result = parse_whatsapp_lineup(self.connection, 'sarria', text)
        self.assertEqual(['Facu', 'Sergio', 'Sergio Pérez'], [item['player'] for item in result['items']])

    def test_extra_spaces_and_accents_do_not_change_identity(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', '  1º   FÁSÚ    (in)  ')
        self.assertEqual('Facu', result['items'][0]['player'])

    def test_operational_headers_do_not_become_fake_players(self):
        result = parse_whatsapp_lineup(
            self.connection, 'sarria', 'CONVOCATORIA MIÉRCOLES 20:00\nLugar: Sarrià\nLista cerrada\nFacu',
        )
        self.assertEqual(['Facu'], [item['player'] for item in result['items']])

    def test_an_unrelated_name_is_unknown_not_auto_matched(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'X Æ A-12')
        self.assertEqual('unknown', result['items'][0]['status'])

    def test_six_a_side_means_twelve_places_and_only_in_players_are_confirmed(self):
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'Reina Elizenda - 6 a side\n1. Facu IN\n2. Sergio\nSuplentes\n13. Sergio Pérez IN',
        )
        self.assertEqual(12, result['capacity'])
        self.assertEqual(2, result['acceptedCount'])
        self.assertEqual(0, result['waitingCount'])
        self.assertEqual(['matched', 'unconfirmed', 'promoted_in'], [item['status'] for item in result['items']])

    def test_final_count_still_excludes_players_without_in(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'FINAL 2\n1. Facu\n2. Sergio')
        self.assertEqual(2, result['capacity'])
        self.assertEqual(0, result['acceptedCount'])
        self.assertFalse(result['complete'])
        self.assertEqual(['unconfirmed', 'unconfirmed'], [item['status'] for item in result['items']])

    def test_capacity_supports_vs_and_eight_a_side_formats(self):
        self.assertEqual(10, parse_whatsapp_lineup(self.connection, 'sarria', '5 vs 5\nFacu IN')['capacity'])
        self.assertEqual(16, parse_whatsapp_lineup(self.connection, 'sarria', '8 a side\nFacu IN')['capacity'])

    def test_divider_infers_capacity_from_the_last_main_slot(self):
        result = parse_whatsapp_lineup(
            self.connection, 'sarria', '1. Facu IN\n12. Sergio IN\nSuplentes\n13. Sergio Pérez IN',
        )
        self.assertEqual(12, result['capacity'])
        self.assertEqual(3, result['acceptedCount'])
        self.assertEqual(0, result['waitingCount'])
        self.assertEqual(1, result['filledVacancies'])

    def test_plus_one_occupies_an_additional_place(self):
        result = parse_whatsapp_lineup(self.connection, 'sarria', 'FINAL 2\n1. Facu +1 IN')
        self.assertEqual('Facu', result['items'][0]['player'])
        self.assertEqual(1, result['items'][0]['guestCount'])
        self.assertEqual(2, result['acceptedCount'])
        self.assertTrue(result['complete'])

    def test_real_tournament_and_schedule_headers_are_ignored(self):
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'NUEVO TORNEO: 12 FECHAS\n04/03 - 19hs\n1. Facu IN\n2. Sergio IN\nSuplentes\n3. Sergio Pérez IN',
        )
        self.assertEqual(['Facu', 'Sergio', 'Sergio Pérez'], [item['player'] for item in result['items']])

    def test_visual_divider_and_whatsapp_invisible_characters_define_capacity(self):
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'Septiembre 9th AMISTOSO no tan amistoso\nReina Elizenda\n'
            '1. Facu IN\n2. Sergio IN\n————\n10.\u2060 \u2060Sergio Pérez IN',
        )
        self.assertEqual(2, result['capacity'])
        self.assertEqual(['Facu', 'Sergio', 'Sergio Pérez'], [item['player'] for item in result['items']])
        self.assertEqual('reserve', result['items'][2]['status'])

    def test_rotation_protects_short_streak_and_uses_first_confirmed_reserve(self):
        self.add_recent_matches([[1], [1]])
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n3. Sergio Pérez IN',
        )
        by_player = {item['player']: item for item in result['items']}
        self.assertEqual('rotated_out', by_player['Facu']['status'])
        self.assertEqual('matched', by_player['Sergio']['status'])
        self.assertEqual('rotated_in', by_player['Sergio Pérez']['status'])
        self.assertEqual('Sergio Pérez', by_player['Facu']['replacedByPlayer'])

    def test_fills_vacancies_before_applying_rotation(self):
        self.add_recent_matches([[1], [1]])
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'FINAL 4\n1. Facu IN\n2. Sergio IN\nSuplentes\n'
            '1. Sergio Pérez IN\n2. Andy S IN\n3. Bhavin IN',
        )
        by_player = {item['player']: item for item in result['items']}
        self.assertEqual(4, result['acceptedCount'])
        self.assertTrue(result['complete'])
        self.assertEqual(2, result['filledVacancies'])
        self.assertEqual('promoted_in', by_player['Sergio Pérez']['status'])
        self.assertEqual('promoted_in', by_player['Andy S']['status'])
        self.assertEqual('rotated_in', by_player['Bhavin']['status'])
        self.assertEqual('rotated_out', by_player['Facu']['status'])
        self.assertEqual(1, result['rotationChanges'])
        self.assertEqual(1, result['waitingCount'])
        self.assertEqual(
            'Titulares\n1. Bhavin IN\n2. Sergio IN\n3. Sergio Pérez IN\n4. Andy S IN\n\n'
            'Suplentes\n1. Facu IN',
            result['whatsappText'],
        )

    def test_matchday_two_rotates_opening_day_players_for_zero_appearance_reserves(self):
        self.add_recent_matches([[1, 2]])
        with patch('sciclon2.services.whatsapp_lineup.random.SystemRandom.shuffle',
                   side_effect=lambda values: None):
            result = parse_whatsapp_lineup(
                self.connection, 'sarria',
                'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n3. Sergio Pérez IN',
            )
        by_player = {item['player']: item for item in result['items']}
        self.assertEqual(1, result['rotationThreshold'])
        self.assertEqual(1, result['rotationChanges'])
        self.assertEqual('rotated_in', by_player['Sergio Pérez']['status'])
        self.assertIn('excepción de la fecha 2', by_player['Sergio Pérez']['rotationReason'])

    def test_whatsapp_output_keeps_original_reserves_then_appends_displaced_players(self):
        self.add_recent_matches([[1, 2]])
        with patch('sciclon2.services.whatsapp_lineup.random.SystemRandom.shuffle',
                   side_effect=lambda values: None):
            result = parse_whatsapp_lineup(
                self.connection, 'sarria',
                'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n'
                '1. Sergio Pérez IN\n2. Andy S IN\n3. Bhavin',
            )
        self.assertEqual(
            'Titulares\n1. Sergio Pérez IN\n2. Andy S IN\n\n'
            'Suplentes\n1. Bhavin\n2. Facu IN\n3. Sergio IN',
            result['whatsappText'],
        )
        displaced = [item for item in result['items'] if item['status'] == 'rotated_out']
        self.assertEqual([0, 1], [item['waitingOrder'] for item in displaced])

    def test_displaced_players_wait_in_shortest_streak_order(self):
        self.add_recent_matches([[1, 2], [1, 2], [1]])
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n'
            '1. Sergio Pérez IN\n2. Andy S IN\n3. Bhavin',
        )
        self.assertEqual(
            ['1. Bhavin', '2. Sergio IN', '3. Facu IN'],
            result['whatsappText'].split('Suplentes\n', 1)[1].splitlines(),
        )

    def test_matchday_three_returns_to_the_normal_two_match_threshold(self):
        self.add_recent_matches([[1], [2]])
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n3. Sergio Pérez IN',
        )
        self.assertEqual(2, result['rotationThreshold'])
        self.assertEqual(0, result['rotationChanges'])

    def test_rotation_removes_longest_streak_before_shorter_eligible_streaks(self):
        self.add_recent_matches([[1, 2], [1, 2], [1]])
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n3. Sergio Pérez IN',
        )
        by_player = {item['player']: item for item in result['items']}
        self.assertEqual(3, by_player['Facu']['consecutiveAppearances'])
        self.assertEqual('rotated_out', by_player['Facu']['status'])
        self.assertEqual('matched', by_player['Sergio']['status'])
        self.assertEqual('rotated_in', by_player['Sergio Pérez']['status'])

    def test_reserve_with_two_consecutive_matches_does_not_displace_anyone(self):
        self.add_recent_matches([[1, 3], [1, 3]])
        result = parse_whatsapp_lineup(
            self.connection, 'sarria',
            'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n3. Sergio Pérez IN',
        )
        self.assertEqual(0, result['rotationChanges'])
        self.assertEqual(['matched', 'matched', 'reserve'], [item['status'] for item in result['items']])

    def test_multiple_eligible_outgoing_players_are_random_and_explained(self):
        self.add_recent_matches([[1, 2], [1, 2]])
        with patch('sciclon2.services.whatsapp_lineup.random.SystemRandom.shuffle',
                   side_effect=lambda values: values.reverse()):
            result = parse_whatsapp_lineup(
                self.connection, 'sarria',
                'FINAL 2\n1. Facu IN\n2. Sergio IN\nSuplentes\n3. Sergio Pérez IN',
            )
        by_player = {item['player']: item for item in result['items']}
        self.assertEqual('matched', by_player['Facu']['status'])
        self.assertEqual('rotated_out', by_player['Sergio']['status'])
        self.assertTrue(by_player['Sergio Pérez']['tieBreakRandom'])
        self.assertIn('sorteo', by_player['Sergio Pérez']['rotationReason'])


if __name__ == '__main__':
    unittest.main()
