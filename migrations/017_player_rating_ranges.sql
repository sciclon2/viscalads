CREATE TABLE player_rating_ranges (
    player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    min_rating REAL NOT NULL CHECK (min_rating >= 1 AND min_rating <= 10),
    max_rating REAL NOT NULL CHECK (max_rating >= 1 AND max_rating <= 10),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (min_rating <= max_rating)
);

INSERT INTO player_rating_ranges (player_id, min_rating, max_rating)
SELECT id, 4.0, 6.5
FROM players
WHERE canonical_name = 'Sergio';
