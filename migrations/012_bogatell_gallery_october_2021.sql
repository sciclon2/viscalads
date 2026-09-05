INSERT INTO venue_photos (
    venue_id, taken_on, image_url, caption, photo_type, source_url, display_order
)
SELECT
    id,
    '2021-10-03',
    '/venues/bogatell-2021-10-03.png',
    'Post-partido en Bogatell',
    'celebration',
    '',
    1
FROM venues
WHERE slug = 'cem-bogatell';
