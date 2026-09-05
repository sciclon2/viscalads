ALTER TABLE matches ADD COLUMN voided_at TEXT;
ALTER TABLE matches ADD COLUMN void_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE match_guests (
    id INTEGER PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    guest_label TEXT NOT NULL,
    team_no INTEGER NOT NULL CHECK (team_no IN (1, 2)),
    lineup_order INTEGER NOT NULL CHECK (lineup_order >= 1),
    UNIQUE (match_id, guest_label),
    UNIQUE (match_id, team_no, lineup_order)
);

CREATE TABLE match_goals (
    id INTEGER PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_no INTEGER NOT NULL CHECK (team_no IN (1, 2)),
    player_id INTEGER REFERENCES players(id),
    guest_id INTEGER REFERENCES match_guests(id),
    goal_count INTEGER NOT NULL CHECK (goal_count > 0),
    CHECK ((player_id IS NOT NULL) != (guest_id IS NOT NULL))
);

CREATE TABLE generated_lineups (
    id INTEGER PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generated_lineup_members (
    lineup_id INTEGER NOT NULL REFERENCES generated_lineups(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id),
    team_no INTEGER NOT NULL CHECK (team_no IN (1, 2)),
    lineup_order INTEGER NOT NULL CHECK (lineup_order >= 1),
    PRIMARY KEY (lineup_id, player_id),
    UNIQUE (lineup_id, team_no, lineup_order)
);

CREATE INDEX idx_match_guests_match ON match_guests(match_id, team_no, lineup_order);
CREATE INDEX idx_match_goals_match ON match_goals(match_id, team_no);
CREATE INDEX idx_generated_lineups_competition ON generated_lineups(competition_id, created_at DESC, id DESC);

