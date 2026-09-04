-- Canonical identities confirmed while preparing the Bogatell history.
UPDATE players SET canonical_name='Martin Rasta', updated_at=CURRENT_TIMESTAMP
WHERE canonical_name='Rasta';

UPDATE players SET canonical_name='Alejandro Solís', updated_at=CURRENT_TIMESTAMP
WHERE canonical_name='Alejandro';

INSERT OR IGNORE INTO players (canonical_name) VALUES
    ('Paulo'),
    ('Johann'),
    ('Matías Rasta');

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Rasta' FROM players WHERE canonical_name='Martin Rasta';
INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Martin Rasta' FROM players WHERE canonical_name='Martin Rasta';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Ale' FROM players WHERE canonical_name='Alejandro Solís';
INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Alejandro' FROM players WHERE canonical_name='Alejandro Solís';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Johan' FROM players WHERE canonical_name='Johann';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Matias Sentous' FROM players WHERE canonical_name='Mati';
INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Matías Sentous' FROM players WHERE canonical_name='Mati';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Matias' FROM players WHERE canonical_name='Matías Rasta';
INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Matías' FROM players WHERE canonical_name='Matías Rasta';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Ryan' FROM players WHERE canonical_name='Ryan W';
INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Rayan' FROM players WHERE canonical_name='Ryan W';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Daniel Paraguay' FROM players WHERE canonical_name='Dani';
INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Dani Paraguay' FROM players WHERE canonical_name='Dani';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Andy' FROM players WHERE canonical_name='Andy S';

INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Sergio P' FROM players WHERE canonical_name='Sergio Pérez';
INSERT OR IGNORE INTO player_aliases (player_id, alias)
SELECT id, 'Pérez' FROM players WHERE canonical_name='Sergio Pérez';
