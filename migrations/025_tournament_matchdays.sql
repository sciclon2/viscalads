ALTER TABLE tournaments ADD COLUMN matchday_count INTEGER CHECK (matchday_count IS NULL OR matchday_count > 0);
