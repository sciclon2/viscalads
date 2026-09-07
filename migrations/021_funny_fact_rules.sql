CREATE TABLE IF NOT EXISTS funny_fact_rules (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

INSERT OR IGNORE INTO funny_fact_rules (code, title, description, priority) VALUES
('classic_rivalry', 'Rivalidad clásica', 'Destaca rivales con muchos enfrentamientos directos.', 10),
('current_streak', 'Racha en juego', 'Detecta rachas vigentes de victorias o derrotas.', 20),
('standings_overtake', 'Duelo por la tabla', 'Detecta jugadores que pueden superar a un rival directo en puntos.', 30),
('long_wait', 'Cuenta pendiente', 'Destaca cuánto lleva un jugador sin vencer a un rival frecuente.', 40);
