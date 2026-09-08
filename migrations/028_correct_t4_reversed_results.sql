-- Correct two T4 results whose team orientation was reversed during import.
-- Both corrections are backed by the faithful WhatsApp export.

UPDATE matches
SET score_team1 = 1,
    score_team2 = 9,
    outcome = '2',
    result_quality = 'exact score',
    evidence_summary = 'Live WhatsApp commentary identifies Facu team as yellow and confirms yellow won 9-1',
    notes = trim(notes || ' Corrected reversed team orientation from 9-1/team 1 to 1-9/team 2.'),
    updated_at = CURRENT_TIMESTAMP
WHERE tournament_id = (SELECT id FROM tournaments WHERE code = 'T4 Sep-Dec24')
  AND played_on = '2024-10-16';

INSERT INTO audit_events(entity_type, entity_id, action, new_value, reason)
SELECT 'match', id, 'correct_result', 'Team 2 won 9-1',
       'WhatsApp live commentary and final score prove the imported winner was reversed'
FROM matches
WHERE tournament_id = (SELECT id FROM tournaments WHERE code = 'T4 Sep-Dec24')
  AND played_on = '2024-10-16';

UPDATE matches
SET score_team1 = 6,
    score_team2 = 3,
    outcome = '1',
    result_quality = 'exact score',
    evidence_summary = 'WhatsApp score image lists six Blue goals and three Pink goals; team list identifies Ivo on Blue',
    notes = trim(notes || ' Corrected reversed team orientation from 3-6/team 2 to 6-3/team 1.'),
    updated_at = CURRENT_TIMESTAMP
WHERE tournament_id = (SELECT id FROM tournaments WHERE code = 'T4 Sep-Dec24')
  AND played_on = '2024-11-20';

INSERT INTO audit_events(entity_type, entity_id, action, new_value, reason)
SELECT 'match', id, 'correct_result', 'Team 1 (Blue) won 6-3',
       'WhatsApp score image resolves the ambiguous text update and proves the imported winner was reversed'
FROM matches
WHERE tournament_id = (SELECT id FROM tournaments WHERE code = 'T4 Sep-Dec24')
  AND played_on = '2024-11-20';
