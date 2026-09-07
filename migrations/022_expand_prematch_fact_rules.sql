ALTER TABLE funny_fact_rules ADD COLUMN scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('competition', 'global'));

INSERT OR IGNORE INTO funny_fact_rules (code, title, description, priority, scope) VALUES
('unbeaten_run', 'Invicto', 'Detecta rachas vigentes sin perder.', 15, 'global'),
('streak_record', 'Récord en juego', 'Compara la racha vigente con el récord histórico del jugador.', 25, 'global');

UPDATE funny_fact_rules SET scope='global'
WHERE code IN ('classic_rivalry', 'current_streak', 'long_wait');
UPDATE funny_fact_rules SET scope='competition'
WHERE code='standings_overtake';
