ALTER TABLE match_goals
ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'regular'
CHECK (goal_type IN ('regular', 'own_goal'));

PRAGMA optimize;
