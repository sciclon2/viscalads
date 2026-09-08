CREATE TABLE tournament_rules (
    id INTEGER PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    rule_code TEXT NOT NULL,
    threshold_value INTEGER NOT NULL,
    points_delta INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tournament_id, rule_code)
);

INSERT INTO tournament_rules (
    tournament_id, rule_code, threshold_value, points_delta, description
)
SELECT id, 'goal_margin_loss', 3, -1,
       '−1 punto por perder por una diferencia de 3 goles o más'
FROM tournaments
WHERE code = 'T10 Jun-Sep26';

CREATE TRIGGER tournament_rules_immutable_update
BEFORE UPDATE ON tournament_rules
BEGIN
    SELECT RAISE(ABORT, 'Las reglas de un torneo son inmutables');
END;

CREATE TRIGGER tournament_rules_immutable_delete
BEFORE DELETE ON tournament_rules
BEGIN
    SELECT RAISE(ABORT, 'Las reglas de un torneo son inmutables');
END;
