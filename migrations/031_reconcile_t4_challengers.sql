-- Reconcile the remembered T4 final-day situation while preserving every
-- recorded win, draw and loss:
--   Facu = Ryan W on 17 points
--   Ivo = Pablo on 15 points
-- A minimum-margin win in the final therefore made Ivo/Pablo champions.

UPDATE matches
SET score_team1=6, score_team2=4,
    result_quality='winner verified; reconstructed score margin',
    evidence_summary='Winner and teams preserved; margin reconstructed to reconcile the documented final-day standings',
    notes=trim(notes || ' Historical score margin adjusted from 6-3 to 6-4; winner unchanged.'),
    updated_at=CURRENT_TIMESTAMP
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-10-30';

INSERT INTO audit_events(entity_type,entity_id,action,new_value,reason)
SELECT 'match',id,'reconstruct_score_margin','Team 1 won 6-4',
       'Reconciles Ivo and Pablo as tied challengers before the T4 final; winner unchanged'
FROM matches
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-10-30';

UPDATE matches
SET score_team1=7, score_team2=9,
    result_quality='winner verified; reconstructed score margin',
    evidence_summary='Winner and teams verified in WhatsApp; margin reconstructed to reconcile the documented final-day standings',
    notes=trim(notes || ' Replaced provisional 6-9 reconstruction with 7-9; winner unchanged.'),
    updated_at=CURRENT_TIMESTAMP
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-11-06';

INSERT INTO audit_events(entity_type,entity_id,action,new_value,reason)
SELECT 'match',id,'reconstruct_score_margin','Team 2 won 9-7',
       'Reconciles both pairs of finalists at equal points before the T4 final; winner unchanged'
FROM matches
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-11-06';
