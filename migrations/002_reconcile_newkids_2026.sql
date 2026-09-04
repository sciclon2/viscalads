-- Reconcile the 2026 history with https://newkidssarria.pages.dev/.
-- Reviewed manually and by near-date roster similarity on 2026-09-04.

-- The site labels this game 2026-07-31, but its complete 12-player roster is
-- identical to our Wednesday 2026-07-29 game. Keep the WhatsApp-derived date
-- and enrich the already-correct outcome with the exact score.
UPDATE matches
SET score_team1 = 6,
    score_team2 = 11,
    result_quality = 'exact score',
    evidence_summary = 'team image plus next-table standings delta; external 2026 site confirms roster, winner and 11-6 score (site date 2026-07-31)',
    notes = 'External site labels the same 12-player match 2026-07-31; retained Wednesday 2026-07-29 to avoid a duplicate.',
    updated_at = CURRENT_TIMESTAMP
WHERE played_on = '2026-07-29' AND tournament_id = 10;

INSERT INTO audit_events(entity_type, entity_id, action, field_name, old_value, new_value, reason)
SELECT 'match', id, 'reconciled', 'score', 'unknown', '6-11',
       'External site has the identical 12-player roster and winner under 2026-07-31; treated as the same 2026-07-29 match.'
FROM matches WHERE played_on = '2026-07-29' AND tournament_id = 10;

INSERT INTO evidence(match_id, evidence_type, source_path, source_timestamp, excerpt, confidence)
SELECT id, 'other', 'https://newkidssarria.pages.dev/', '2026-09-04',
       'Published as 2026-07-31: Blue 11-6 Pink; all 12 players match the local 2026-07-29 record with team sides reversed.', 'confirmed'
FROM matches WHERE played_on = '2026-07-29' AND tournament_id = 10;

-- On 2026-07-15 the published teams place Pau on the winning side and
-- Sergio Perez on the losing side. Rebuild the lineup to make the assignment
-- explicit and deterministic.
DELETE FROM match_players
WHERE match_id = (SELECT id FROM matches WHERE played_on = '2026-07-15' AND tournament_id = 10);

INSERT INTO match_players(match_id, player_id, team_no, lineup_order) VALUES
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Gus'), 1, 1),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Ivo'), 1, 2),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Niyi'), 1, 3),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Pau'), 1, 4),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Pete'), 1, 5),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Yoann'), 1, 6),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Aidan'), 2, 1),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Facu'), 2, 2),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Gimmi'), 2, 3),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Pablo'), 2, 4),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Sergio Pérez'), 2, 5),
((SELECT id FROM matches WHERE played_on='2026-07-15' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Dani'), 2, 6);

UPDATE matches
SET score_team1 = 4, score_team2 = 3, result_quality = 'exact score',
    evidence_summary = 'official 19:00 final roster plus standings delta; external 2026 site confirms score and corrects Pau/Sergio Perez team assignment',
    updated_at = CURRENT_TIMESTAMP
WHERE played_on = '2026-07-15' AND tournament_id = 10;

INSERT INTO audit_events(entity_type, entity_id, action, field_name, old_value, new_value, reason)
SELECT 'match', id, 'corrected', 'team_assignment',
       'Sergio Pérez winner; Pau loser', 'Pau winner; Sergio Pérez loser',
       'Reconciled against the published 2026 match record.'
FROM matches WHERE played_on = '2026-07-15' AND tournament_id = 10;

INSERT INTO evidence(match_id, evidence_type, source_path, source_timestamp, excerpt, confidence)
SELECT id, 'other', 'https://newkidssarria.pages.dev/', '2026-09-04',
       '2026-07-15: Blue 4-3 Pink; Pau listed with the winner and Sergio Pérez with the loser.', 'confirmed'
FROM matches WHERE played_on = '2026-07-15' AND tournament_id = 10;

-- The external record distinguishes Sergio from Sergio Perez on 2026-08-05.
UPDATE match_players
SET player_id = (SELECT id FROM players WHERE canonical_name = 'Sergio')
WHERE match_id = (SELECT id FROM matches WHERE played_on = '2026-08-05' AND tournament_id = 10)
  AND player_id = (SELECT id FROM players WHERE canonical_name = 'Sergio Pérez');

UPDATE matches
SET evidence_summary = 'team image plus live score and standings delta; external 2026 site identifies Sergio (not Sergio Pérez)',
    updated_at = CURRENT_TIMESTAMP
WHERE played_on = '2026-08-05' AND tournament_id = 10;

INSERT INTO audit_events(entity_type, entity_id, action, field_name, old_value, new_value, reason)
SELECT 'match', id, 'corrected', 'player_identity', 'Sergio Pérez', 'Sergio',
       'Published 2026 record explicitly lists Sergio; the two players are distinct in the canonical roster.'
FROM matches WHERE played_on = '2026-08-05' AND tournament_id = 10;

INSERT INTO evidence(match_id, evidence_type, source_path, source_timestamp, excerpt, confidence)
SELECT id, 'other', 'https://newkidssarria.pages.dev/', '2026-09-04',
       '2026-08-05: Pink 7-4 Blue; losing lineup names Sergio.', 'confirmed'
FROM matches WHERE played_on = '2026-08-05' AND tournament_id = 10;

-- Two published matches have no credible near-date duplicate in SQLite.
INSERT INTO matches(played_on, tournament_id, score_team1, score_team2, outcome, result_quality, coverage_status, evidence_summary, notes)
VALUES ('2026-03-25', 9, 3, 3, 'D', 'exact score', 'verified',
        'external 2026 match record with complete teams and exact score',
        'No near-date local match has a sufficiently similar roster; imported during 2026 reconciliation.');

INSERT INTO match_players(match_id, player_id, team_no, lineup_order) VALUES
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Pau'), 1, 1),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Milton'), 1, 2),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Ivo'), 1, 3),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Dani'), 1, 4),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Des'), 1, 5),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Mario'), 1, 6),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Gimmi'), 2, 1),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Aidan'), 2, 2),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Yoann'), 2, 3),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Pete'), 2, 4),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Mark'), 2, 5),
((SELECT id FROM matches WHERE played_on='2026-03-25' AND tournament_id=9), (SELECT id FROM players WHERE canonical_name='Mati'), 2, 6);

INSERT INTO evidence(match_id, evidence_type, source_path, source_timestamp, excerpt, confidence)
SELECT id, 'other', 'https://newkidssarria.pages.dev/', '2026-09-04',
       '2026-03-25: Blue 3-3 Pink, complete six-a-side teams.', 'confirmed'
FROM matches WHERE played_on = '2026-03-25' AND tournament_id = 9;

INSERT INTO audit_events(entity_type, entity_id, action, reason)
SELECT 'match', id, 'imported', 'Complete external record; no credible near-date duplicate.'
FROM matches WHERE played_on = '2026-03-25' AND tournament_id = 9;

INSERT INTO matches(played_on, tournament_id, score_team1, score_team2, outcome, result_quality, coverage_status, evidence_summary, notes)
VALUES ('2026-08-26', 10, 5, 10, '2', 'exact score', 'verified',
        'external 2026 match record with complete teams and exact score',
        'No near-date local match has the same roster; imported during 2026 reconciliation.');

INSERT INTO match_players(match_id, player_id, team_no, lineup_order) VALUES
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Aidan'), 1, 1),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Facu'), 1, 2),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Gimmi'), 1, 3),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Ivo'), 1, 4),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Mati'), 1, 5),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Andy S'), 2, 1),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Gus'), 2, 2),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Pablo'), 2, 3),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Salsa'), 2, 4),
((SELECT id FROM matches WHERE played_on='2026-08-26' AND tournament_id=10), (SELECT id FROM players WHERE canonical_name='Sergio'), 2, 5);

INSERT INTO evidence(match_id, evidence_type, source_path, source_timestamp, excerpt, confidence)
SELECT id, 'other', 'https://newkidssarria.pages.dev/', '2026-09-04',
       '2026-08-26: Blue 5-10 Pink, complete five-a-side teams.', 'confirmed'
FROM matches WHERE played_on = '2026-08-26' AND tournament_id = 10;

INSERT INTO audit_events(entity_type, entity_id, action, reason)
SELECT 'match', id, 'imported', 'Complete external record; no same-roster near-date duplicate.'
FROM matches WHERE played_on = '2026-08-26' AND tournament_id = 10;

PRAGMA optimize;
