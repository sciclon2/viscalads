INSERT OR REPLACE INTO player_positions (player_id, position, priority)
SELECT id, 'Mediocampo por izquierda', 1
FROM players
WHERE canonical_name = 'Alejandro Solís';

INSERT OR REPLACE INTO player_rating_ranges (player_id, min_rating, max_rating, updated_at)
SELECT id, 5.0, 7.0, CURRENT_TIMESTAMP
FROM players
WHERE canonical_name = 'Alejandro Solís';
