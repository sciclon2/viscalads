INSERT OR IGNORE INTO funny_fact_rules (code, title, description, priority, scope) VALUES
('hot_pair', 'Dupla caliente', 'Destaca compañeros que ganaron juntos sus últimos tres partidos compartidos.', 14, 'global'),
('nemesis', 'Bestia negra', 'Destaca un dominio claro tras al menos cinco enfrentamientos directos.', 16, 'global'),
('leader_clash', 'Choque de líderes', 'Detecta cuando los líderes de la edición actual quedan enfrentados.', 8, 'competition'),
('team_experience', 'Experiencia acumulada', 'Compara los partidos históricos acumulados por ambos equipos.', 35, 'global'),
('comeback', 'Debut o regreso', 'Detecta un debut o una vuelta después de treinta días sin jugar.', 22, 'global'),
('century_watch', 'Camino a los 100', 'Destaca a quien puede alcanzar cien participaciones.', 24, 'global');
