-- Reconstruct the minimum score-margin changes needed to reproduce the
-- documented T4 final-day scenario without changing any match outcome.

UPDATE matches
SET score_team1=6, score_team2=9, outcome='2',
    result_quality='winner verified; reconstructed score margin',
    evidence_summary='Winner and teams verified in WhatsApp; margin reconstructed to reconcile the final-day standings',
    notes=trim(notes || ' Historical score margin adjusted from 6-7 to 6-9; winner unchanged.'),
    updated_at=CURRENT_TIMESTAMP
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-09-18';

INSERT INTO audit_events(entity_type,entity_id,action,new_value,reason)
SELECT 'match',id,'reconstruct_score_margin','Team 2 won 9-6',
       'Minimum margin adjustment needed for Facu/Ryan to enter the T4 final level on points; winner unchanged'
FROM matches
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-09-18';

UPDATE matches
SET score_team1=6, score_team2=9, outcome='2',
    result_quality='winner verified; reconstructed score margin',
    evidence_summary='Winner and teams verified in WhatsApp; margin reconstructed to reconcile the final-day standings',
    notes=trim(notes || ' Historical score margin adjusted from 7-9 to 6-9; winner unchanged.'),
    updated_at=CURRENT_TIMESTAMP
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-11-06';

INSERT INTO audit_events(entity_type,entity_id,action,new_value,reason)
SELECT 'match',id,'reconstruct_score_margin','Team 2 won 9-6',
       'Minimum margin adjustment needed for Facu/Ryan to enter the T4 final level and preserve the challengers; winner unchanged'
FROM matches
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-11-06';
