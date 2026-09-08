-- Restore the exact 18 September score after a superseded reconstruction draft.
UPDATE matches
SET score_team1=6, score_team2=7, outcome='2', result_quality='exact score',
    evidence_summary='Teams plus live final-score confirmation',
    notes=trim(notes || ' Restored verified 6-7 score; supersedes provisional margin reconstruction.'),
    updated_at=CURRENT_TIMESTAMP
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-09-18';

INSERT OR IGNORE INTO tournament_rules(tournament_id,rule_code,threshold_value,points_delta,description)
SELECT id,'goal_margin_both',3,1,'+1 al ganador y -1 al perdedor por cada 3 goles de diferencia'
FROM tournaments WHERE code='T4 Sep-Dec24';

INSERT INTO audit_events(entity_type,entity_id,action,new_value,reason)
SELECT 'match',id,'restore_verified_result','Team 2 won 7-6',
       'Supersedes provisional score-margin reconstruction; faithful WhatsApp export confirms 6-7'
FROM matches
WHERE tournament_id=(SELECT id FROM tournaments WHERE code='T4 Sep-Dec24')
  AND played_on='2024-09-18';
