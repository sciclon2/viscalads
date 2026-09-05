INSERT INTO venue_photos (
    venue_id, taken_on, image_url, caption, photo_type, source_url, display_order
)
SELECT
    id,
    '2021-07-02',
    '/venues/bogatell-2021-07-02.png',
    'Equipo en Bogatell',
    'team',
    '',
    1
FROM venues
WHERE slug = 'cem-bogatell';
