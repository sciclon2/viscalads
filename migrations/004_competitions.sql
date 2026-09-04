CREATE TABLE competitions (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name TEXT NOT NULL,
    usual_weekday INTEGER CHECK (usual_weekday IS NULL OR usual_weekday BETWEEN 0 AND 6),
    venue TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO competitions (slug, display_name, usual_weekday, venue)
VALUES
    ('sarria', 'Sarrià', 2, 'Reina Elisenda'),
    ('bogatell', 'Bogatell', 5, 'Bogatell');

ALTER TABLE tournaments ADD COLUMN competition_id INTEGER REFERENCES competitions(id);

UPDATE tournaments
SET competition_id = (SELECT id FROM competitions WHERE slug = 'sarria');

CREATE INDEX idx_tournaments_competition
ON tournaments(competition_id, starts_on, ends_on);
