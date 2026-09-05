INSERT INTO venue_photos (
    venue_id, taken_on, image_url, caption, photo_type, source_url, display_order
)
SELECT
    id,
    '2024-02-29',
    '/venues/sarria-2024-02-29.png',
    'Equipo en Sarrià',
    'team',
    '',
    1
FROM venues
WHERE slug = 'sagrat-cor-sarria';
