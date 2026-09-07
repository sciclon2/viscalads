CREATE TABLE generated_lineup_guests (
    lineup_id INTEGER NOT NULL REFERENCES generated_lineups(id) ON DELETE CASCADE,
    guest_label TEXT NOT NULL,
    team_no INTEGER NOT NULL CHECK (team_no IN (1, 2)),
    lineup_order INTEGER NOT NULL CHECK (lineup_order >= 1),
    level REAL NOT NULL CHECK (level >= 1 AND level <= 10),
    primary_position TEXT,
    PRIMARY KEY (lineup_id, guest_label),
    UNIQUE (lineup_id, team_no, lineup_order)
);
