PRAGMA foreign_keys = ON;

CREATE TABLE players (
    id INTEGER PRIMARY KEY,
    canonical_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_aliases (
    id INTEGER PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    alias TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_positions (
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    position TEXT NOT NULL,
    priority INTEGER NOT NULL CHECK (priority >= 1),
    PRIMARY KEY (player_id, priority),
    UNIQUE (player_id, position)
);

CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    starts_on TEXT,
    ends_on TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE matches (
    id INTEGER PRIMARY KEY,
    played_on TEXT NOT NULL,
    tournament_id INTEGER REFERENCES tournaments(id),
    score_team1 INTEGER CHECK (score_team1 IS NULL OR score_team1 >= 0),
    score_team2 INTEGER CHECK (score_team2 IS NULL OR score_team2 >= 0),
    outcome TEXT NOT NULL CHECK (outcome IN ('1', '2', 'D', '?')),
    result_quality TEXT NOT NULL,
    coverage_status TEXT NOT NULL CHECK (coverage_status IN ('verified', 'pending')),
    evidence_summary TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (played_on, tournament_id)
);

CREATE TABLE match_players (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id),
    team_no INTEGER NOT NULL CHECK (team_no IN (1, 2)),
    lineup_order INTEGER NOT NULL CHECK (lineup_order >= 1),
    position_played TEXT,
    PRIMARY KEY (match_id, player_id),
    UNIQUE (match_id, team_no, lineup_order)
);

CREATE TABLE evidence (
    id INTEGER PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('chat', 'image', 'video', 'manual', 'other')),
    source_path TEXT,
    source_timestamp TEXT,
    excerpt TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK (confidence IN ('confirmed', 'probable', 'uncertain')),
    sha256 TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tournament_champions (
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id),
    PRIMARY KEY (tournament_id, player_id)
);

CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matches_played_on ON matches(played_on);
CREATE INDEX idx_matches_tournament ON matches(tournament_id, played_on);
CREATE INDEX idx_match_players_player ON match_players(player_id, match_id);
CREATE INDEX idx_evidence_match ON evidence(match_id);

