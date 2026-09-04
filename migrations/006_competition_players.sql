-- Players are global identities. This join table records the competitions in
-- which each player participates without duplicating or renaming the player.
CREATE TABLE competition_players (
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    joined_on TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (competition_id, player_id)
);

CREATE INDEX idx_competition_players_player
ON competition_players(player_id, competition_id);

-- Existing match participation is authoritative for initial memberships.
INSERT OR IGNORE INTO competition_players (competition_id, player_id, joined_on)
SELECT DISTINCT c.id, mp.player_id, MIN(m.played_on)
FROM match_players mp
JOIN matches m ON m.id = mp.match_id
JOIN tournaments t ON t.id = m.tournament_id
JOIN competitions c ON c.id = t.competition_id
GROUP BY c.id, mp.player_id;
