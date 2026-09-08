-- Reconstruct the 2024-12-18 T4 final from the WhatsApp attendance list,
-- the confirmed finalist pairs and the confirmed winning side.
-- The exact score was not recovered, so no goal-margin adjustment is valid.

UPDATE matches
SET score_team1 = NULL,
    score_team2 = NULL,
    outcome = '1',
    result_quality = 'winner known; exact score not recovered',
    coverage_status = 'verified',
    evidence_summary = 'WhatsApp confirms Facu and Ryan W defeated the side containing Pablo and Ivo',
    notes = 'Core pairs and outcome confirmed. Remaining teammates are an approved reconstruction: Mati swapped with Gus in the final proposal.',
    updated_at = CURRENT_TIMESTAMP
WHERE tournament_id = (SELECT id FROM tournaments WHERE code = 'T4 Sep-Dec24')
  AND played_on = '2024-12-18';

DELETE FROM match_players
WHERE match_id = (
    SELECT id FROM matches
    WHERE tournament_id = (SELECT id FROM tournaments WHERE code = 'T4 Sep-Dec24')
      AND played_on = '2024-12-18'
);

INSERT INTO match_players(match_id, player_id, team_no, lineup_order)
SELECT m.id, p.id, v.team_no, v.lineup_order
FROM matches m
JOIN tournaments t ON t.id = m.tournament_id
JOIN (
    SELECT 'Facu' player_name, 1 team_no, 1 lineup_order UNION ALL
    SELECT 'Ryan W', 1, 2 UNION ALL
    SELECT 'Sergio', 1, 3 UNION ALL
    SELECT 'Mati', 1, 4 UNION ALL
    SELECT 'Adrien', 1, 5 UNION ALL
    SELECT 'Niyi', 1, 6 UNION ALL
    SELECT 'Pablo', 2, 1 UNION ALL
    SELECT 'Ivo', 2, 2 UNION ALL
    SELECT 'Andy C', 2, 3 UNION ALL
    SELECT 'Des', 2, 4 UNION ALL
    SELECT 'Yoann', 2, 5 UNION ALL
    SELECT 'Gus', 2, 6
) v
JOIN players p ON p.canonical_name = v.player_name
WHERE t.code = 'T4 Sep-Dec24'
  AND m.played_on = '2024-12-18';

INSERT INTO audit_events(entity_type, entity_id, action, new_value, reason)
SELECT 'match', m.id, 'reconstruct',
       'Facu, Ryan W, Sergio, Mati, Adrien, Niyi beat Pablo, Ivo, Andy C, Des, Yoann, Gus; exact score unknown',
       'T4 final reconstructed from WhatsApp evidence and user-approved teammate proposal'
FROM matches m
JOIN tournaments t ON t.id = m.tournament_id
WHERE t.code = 'T4 Sep-Dec24'
  AND m.played_on = '2024-12-18';
