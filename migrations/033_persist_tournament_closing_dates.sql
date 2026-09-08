-- A tournament closing date is domain data, not a presentation fallback.
-- Historical editions close on their latest registered non-voided match.
UPDATE tournaments
SET ends_on = (
    SELECT MAX(m.played_on)
    FROM matches m
    WHERE m.tournament_id = tournaments.id
      AND m.voided_at IS NULL
)
WHERE ends_on IS NULL
  AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.tournament_id = tournaments.id
      AND m.voided_at IS NULL
  );

CREATE TRIGGER tournaments_require_closing_date_insert
BEFORE INSERT ON tournaments
WHEN NEW.ends_on IS NULL OR trim(NEW.ends_on) = ''
BEGIN
    SELECT RAISE(ABORT, 'La fecha de cierre del torneo es obligatoria');
END;

CREATE TRIGGER tournaments_require_closing_date_update
BEFORE UPDATE OF ends_on ON tournaments
WHEN NEW.ends_on IS NULL OR trim(NEW.ends_on) = ''
BEGIN
    SELECT RAISE(ABORT, 'La fecha de cierre del torneo es obligatoria');
END;
