CREATE TABLE venue_photos (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    taken_on TEXT,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    photo_type TEXT NOT NULL DEFAULT 'venue'
        CHECK (photo_type IN ('venue', 'match', 'team', 'celebration')),
    source_url TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_venue_photos_venue_date
ON venue_photos(venue_id, taken_on DESC, display_order, id);

INSERT INTO venue_photos (venue_id, image_url, caption, photo_type, source_url)
SELECT id, image_url, 'Vista de las instalaciones', 'venue', image_source_url
FROM venues;
