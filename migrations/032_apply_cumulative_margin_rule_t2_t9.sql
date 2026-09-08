-- The historical championship rows remain an audit snapshot. From T2 through
-- T9, standings and champions are now calculated with the confirmed rule.
INSERT OR IGNORE INTO tournament_rules(
    tournament_id, rule_code, threshold_value, points_delta, description
)
SELECT id, 'goal_margin_both', 3, 1,
       '+1 al ganador y -1 al perdedor por cada 3 goles de diferencia'
FROM tournaments
WHERE id BETWEEN 2 AND 9;

INSERT INTO audit_events(entity_type, entity_id, action, new_value, reason)
SELECT 'tournament', id, 'assign_historical_rule', 'goal_margin_both',
       'Confirmed against the stored champions before enabling dynamic champion calculation'
FROM tournaments
WHERE id BETWEEN 2 AND 9;
