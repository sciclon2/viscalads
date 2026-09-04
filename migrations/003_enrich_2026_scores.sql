-- Add exact scores for 2026 matches whose teams and W/D/L outcomes already
-- matched the published external record. These do not change player points.

UPDATE matches SET score_team1=4, score_team2=5, result_quality='exact score',
  evidence_summary=evidence_summary || '; external 2026 site confirms exact 4-5 score', updated_at=CURRENT_TIMESTAMP
WHERE played_on='2026-02-25' AND tournament_id=8;

UPDATE matches SET score_team1=6, score_team2=0, result_quality='exact score',
  evidence_summary=evidence_summary || '; external 2026 site confirms exact 6-0 score', updated_at=CURRENT_TIMESTAMP
WHERE played_on='2026-04-01' AND tournament_id=9;

-- The external page's Blue/Pink sides are reversed relative to local team 1/2.
UPDATE matches SET score_team1=5, score_team2=8, result_quality='exact score',
  evidence_summary=evidence_summary || '; external 2026 site confirms exact score (published sides reversed)', updated_at=CURRENT_TIMESTAMP
WHERE played_on='2026-06-10' AND tournament_id=10;

UPDATE matches SET score_team1=13, score_team2=3, result_quality='exact score',
  evidence_summary=evidence_summary || '; external 2026 site confirms exact 13-3 score', updated_at=CURRENT_TIMESTAMP
WHERE played_on='2026-06-17' AND tournament_id=10;

UPDATE matches SET score_team1=10, score_team2=3, result_quality='exact score',
  evidence_summary=evidence_summary || '; external 2026 site confirms exact 10-3 score', updated_at=CURRENT_TIMESTAMP
WHERE played_on='2026-07-01' AND tournament_id=10;

UPDATE matches SET score_team1=5, score_team2=3, result_quality='exact score',
  evidence_summary=evidence_summary || '; external 2026 site confirms exact 5-3 score', updated_at=CURRENT_TIMESTAMP
WHERE played_on='2026-07-08' AND tournament_id=10;

INSERT INTO evidence(match_id,evidence_type,source_path,source_timestamp,excerpt,confidence)
SELECT id,'other','https://newkidssarria.pages.dev/','2026-09-04',
       played_on || ': complete roster and exact score agree with the existing outcome.','confirmed'
FROM matches WHERE played_on IN ('2026-02-25','2026-04-01','2026-06-10','2026-06-17','2026-07-01','2026-07-08');

INSERT INTO audit_events(entity_type,entity_id,action,field_name,old_value,new_value,reason)
SELECT 'match',id,'enriched','score','unknown',score_team1 || '-' || score_team2,
       'Exact score added from the external record after roster and outcome agreement.'
FROM matches WHERE played_on IN ('2026-02-25','2026-04-01','2026-06-10','2026-06-17','2026-07-01','2026-07-08');

PRAGMA optimize;
