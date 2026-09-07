-- Six Bogatell matches recovered from the former Viscalads database.
-- The 2025-02-15 three-team mini tournament is intentionally excluded.
-- Legacy game 16 says 2025-04-20, but the associated Saturday fixture was
-- 2025-04-19; we retain both facts in the evidence text.

WITH recovered(played_on, score_team1, score_team2, outcome, evidence_summary) AS (
    VALUES
      ('2025-03-15', 3, 6, '2', 'Legacy Viscalads game 11; teams, score and awarded points agree'),
      ('2025-04-19', 3, 4, '2', 'Legacy Viscalads game 16 dated 2025-04-20; normalized to Saturday 2025-04-19'),
      ('2025-04-26', 2, 5, '2', 'Legacy Viscalads game 17; teams, score and awarded points agree'),
      ('2025-05-10', 6, 4, '1', 'Legacy Viscalads game 19; teams, score and awarded points agree'),
      ('2025-05-24', 2, 4, '2', 'Legacy Viscalads game 20; teams, score and awarded points agree'),
      ('2025-05-31', 2, 1, '1', 'Legacy Viscalads game 21; teams, score and awarded points agree')
)
INSERT INTO matches (
    played_on, tournament_id, score_team1, score_team2, outcome,
    result_quality, coverage_status, evidence_summary, notes
)
SELECT played_on, t.id, score_team1, score_team2, outcome,
       'exact score', 'verified', evidence_summary,
       'Recovered from former Viscalads database; registered players only'
FROM recovered
JOIN tournaments t ON t.code='BOGATELL-FRIENDLIES';

WITH roster(played_on, team_no, lineup_order, player_name) AS (
    VALUES
      ('2025-03-15',1,1,'Paulo'), ('2025-03-15',1,2,'Max'), ('2025-03-15',1,3,'Sim'), ('2025-03-15',1,4,'Gus'),
      ('2025-03-15',1,5,'Pete'), ('2025-03-15',1,6,'Ian'), ('2025-03-15',1,7,'Sergio'), ('2025-03-15',1,8,'Dani'),
      ('2025-03-15',2,1,'Andy S'), ('2025-03-15',2,2,'Mati'), ('2025-03-15',2,3,'Martin'), ('2025-03-15',2,4,'André'),
      ('2025-03-15',2,5,'Gimmi'), ('2025-03-15',2,6,'Aidan'), ('2025-03-15',2,7,'Milton'), ('2025-03-15',2,8,'Ivo'),

      ('2025-04-19',1,1,'Edwin'), ('2025-04-19',1,2,'Max'), ('2025-04-19',1,3,'Des'), ('2025-04-19',1,4,'Ryan W'),
      ('2025-04-19',1,5,'Aidan'), ('2025-04-19',1,6,'Martin Rasta'),
      ('2025-04-19',2,1,'Sim'), ('2025-04-19',2,2,'Yoann'), ('2025-04-19',2,3,'Pete'), ('2025-04-19',2,4,'Johann'),
      ('2025-04-19',2,5,'Facu'), ('2025-04-19',2,6,'Bhavin'),

      ('2025-04-26',1,1,'Paulo'), ('2025-04-26',1,2,'Sim'), ('2025-04-26',1,3,'Mati'), ('2025-04-26',1,4,'Facu'),
      ('2025-04-26',1,5,'Ivo'), ('2025-04-26',1,6,'Salsa'),
      ('2025-04-26',2,1,'Andy S'), ('2025-04-26',2,2,'Gus'), ('2025-04-26',2,3,'Amro'), ('2025-04-26',2,4,'Gimmi'),
      ('2025-04-26',2,5,'Johann'), ('2025-04-26',2,6,'Niyi'), ('2025-04-26',2,7,'Alex'),

      ('2025-05-10',1,1,'Paulo'), ('2025-05-10',1,2,'Max'), ('2025-05-10',1,3,'Mati'), ('2025-05-10',1,4,'Martin'),
      ('2025-05-10',1,5,'Pete'), ('2025-05-10',1,6,'Ryan W'), ('2025-05-10',1,7,'Aidan'), ('2025-05-10',1,8,'Facu'),
      ('2025-05-10',2,1,'Andy S'), ('2025-05-10',2,2,'Gus'), ('2025-05-10',2,3,'Amro'), ('2025-05-10',2,4,'Johann'),
      ('2025-05-10',2,5,'Sergio'), ('2025-05-10',2,6,'Martin Rasta'), ('2025-05-10',2,7,'Niyi'), ('2025-05-10',2,8,'Salsa'),

      ('2025-05-24',1,1,'Paulo'), ('2025-05-24',1,2,'Edwin'), ('2025-05-24',1,3,'Mati'), ('2025-05-24',1,4,'Amro'),
      ('2025-05-24',1,5,'Pete'), ('2025-05-24',1,6,'Facu'), ('2025-05-24',1,7,'Milton'), ('2025-05-24',1,8,'Sergio'),
      ('2025-05-24',2,1,'Yoann'), ('2025-05-24',2,2,'Martin'), ('2025-05-24',2,3,'Gimmi'), ('2025-05-24',2,4,'Aidan'),
      ('2025-05-24',2,5,'Johann'), ('2025-05-24',2,6,'Dani'), ('2025-05-24',2,7,'Edu'),

      ('2025-05-31',1,1,'Paulo'), ('2025-05-31',1,2,'Gus'), ('2025-05-31',1,3,'Mati'), ('2025-05-31',1,4,'Des'),
      ('2025-05-31',1,5,'Gimmi'), ('2025-05-31',1,6,'Aidan'), ('2025-05-31',1,7,'Milton'), ('2025-05-31',1,8,'Bhavin'),
      ('2025-05-31',2,1,'Edwin'), ('2025-05-31',2,2,'Andy S'), ('2025-05-31',2,3,'Amro'), ('2025-05-31',2,4,'Ryan W'),
      ('2025-05-31',2,5,'Johann'), ('2025-05-31',2,6,'Facu'), ('2025-05-31',2,7,'Sergio'), ('2025-05-31',2,8,'Niall O')
)
INSERT INTO match_players(match_id, player_id, team_no, lineup_order)
SELECT m.id, p.id, r.team_no, r.lineup_order
FROM roster r
JOIN players p ON p.canonical_name=r.player_name
JOIN tournaments t ON t.code='BOGATELL-FRIENDLIES'
JOIN matches m ON m.tournament_id=t.id AND m.played_on=r.played_on;

INSERT OR IGNORE INTO competition_players(competition_id, player_id, joined_on)
SELECT c.id, mp.player_id, MIN(m.played_on)
FROM match_players mp
JOIN matches m ON m.id=mp.match_id
JOIN tournaments t ON t.id=m.tournament_id
JOIN competitions c ON c.id=t.competition_id
WHERE c.slug='bogatell'
GROUP BY c.id, mp.player_id;

INSERT INTO evidence(match_id, evidence_type, source_path, source_timestamp, excerpt, confidence)
SELECT m.id, 'other', 'Visca.sql.gz', m.played_on,
       m.evidence_summary, 'confirmed'
FROM matches m
JOIN tournaments t ON t.id=m.tournament_id
WHERE t.code='BOGATELL-FRIENDLIES'
  AND m.played_on IN ('2025-03-15','2025-04-19','2025-04-26','2025-05-10','2025-05-24','2025-05-31');
