CREATE TABLE player_details (
    player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    nickname TEXT NOT NULL DEFAULT '',
    birth_date TEXT CHECK (birth_date IS NULL OR birth_date GLOB '????-??-??'),
    nationality TEXT NOT NULL DEFAULT '',
    preferred_foot TEXT CHECK (preferred_foot IS NULL OR preferred_foot IN ('Izquierda', 'Derecha', 'Ambas')),
    bio TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO player_details (
    player_id, first_name, last_name, nickname, birth_date, nationality, preferred_foot
)
SELECT id, 'Sergio', 'Troiano', 'Pelado', '1982-01-14', 'Argentina', 'Izquierda'
FROM players
WHERE canonical_name = 'Sergio';
