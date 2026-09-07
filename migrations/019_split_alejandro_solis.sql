-- Alejandro (Sarria) and Alejandro Solis (Bogatell) are different people.
-- The profile photo and profile settings previously shown in Sarria belong to Alejandro.
INSERT INTO players (canonical_name, active, notes, photo_path, photo_source_url)
SELECT 'Alejandro', 1, 'Jugador distinto de Alejandro Solís; participa en Sarrià.', photo_path, photo_source_url
FROM players
WHERE canonical_name = 'Alejandro Solís'
  AND NOT EXISTS (SELECT 1 FROM players WHERE canonical_name = 'Alejandro');

INSERT OR REPLACE INTO competition_players (competition_id, player_id, active, joined_on, notes)
SELECT cp.competition_id, target.id, cp.active, cp.joined_on, cp.notes
FROM competition_players cp
JOIN players source ON source.id = cp.player_id AND source.canonical_name = 'Alejandro Solís'
JOIN competitions c ON c.id = cp.competition_id AND c.slug = 'sarria'
JOIN players target ON target.canonical_name = 'Alejandro';

UPDATE match_players
SET player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro')
WHERE player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro Solís')
  AND match_id IN (
    SELECT m.id FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    JOIN competitions c ON c.id = t.competition_id
    WHERE c.slug = 'sarria'
  );

UPDATE match_goals
SET player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro')
WHERE player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro Solís')
  AND match_id IN (
    SELECT m.id FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    JOIN competitions c ON c.id = t.competition_id
    WHERE c.slug = 'sarria'
  );

UPDATE generated_lineup_members
SET player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro')
WHERE player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro Solís')
  AND lineup_id IN (
    SELECT gl.id FROM generated_lineups gl
    JOIN competitions c ON c.id = gl.competition_id
    WHERE c.slug = 'sarria'
  );

UPDATE player_aliases
SET player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro')
WHERE player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro Solís')
  AND lower(alias) IN ('alejandro', 'ale');

INSERT OR REPLACE INTO player_positions (player_id, position, priority)
SELECT target.id, pp.position, pp.priority
FROM player_positions pp
JOIN players source ON source.id = pp.player_id AND source.canonical_name = 'Alejandro Solís'
JOIN players target ON target.canonical_name = 'Alejandro';

INSERT OR REPLACE INTO player_rating_ranges (player_id, min_rating, max_rating, updated_at)
SELECT target.id, pr.min_rating, pr.max_rating, pr.updated_at
FROM player_rating_ranges pr
JOIN players source ON source.id = pr.player_id AND source.canonical_name = 'Alejandro Solís'
JOIN players target ON target.canonical_name = 'Alejandro';

DELETE FROM competition_players
WHERE player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro Solís')
  AND competition_id = (SELECT id FROM competitions WHERE slug = 'sarria');

DELETE FROM player_positions
WHERE player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro Solís');

DELETE FROM player_rating_ranges
WHERE player_id = (SELECT id FROM players WHERE canonical_name = 'Alejandro Solís');

UPDATE players
SET photo_path = NULL, photo_source_url = NULL,
    notes = 'Jugador distinto de Alejandro; participa en Bogatell.',
    updated_at = CURRENT_TIMESTAMP
WHERE canonical_name = 'Alejandro Solís';
