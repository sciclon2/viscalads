CREATE TABLE venues (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    public_hours TEXT NOT NULL DEFAULT '',
    group_schedule TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL DEFAULT '',
    maps_url TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    image_source_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE competition_venues (
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('primary', 'alternate')),
    display_order INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (competition_id, venue_id)
);

CREATE TABLE venue_facts (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('useful', 'funny')),
    fact_text TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1
);

INSERT INTO venues (
    slug, display_name, address, phone, email, public_hours, group_schedule,
    website_url, maps_url, image_url, image_source_url, description
) VALUES
(
    'cem-bogatell', 'CEM Bogatell', 'Carrer de Carmen Amaya, 4-6, 08005 Barcelona',
    '93 221 65 67', 'info@cembogatell.com',
    'Lunes a viernes 10:00-00:00; sábados, domingos y festivos 09:00-21:00.',
    'Sábados: sede oficial del grupo (habitualmente a las 15:00).', 'https://cembogatell.com/es/',
    'https://www.google.com/maps/search/?api=1&query=CEM+Bogatell',
    'https://cembogatell.com/wp-content/uploads/sites/35/2025/08/instalacio_Bogatell_1.webp',
    'https://cembogatell.com/es/',
    'Campo municipal de césped artificial en Poblenou y sede oficial de los partidos del sábado.'
),
(
    'sagrat-cor-sarria', 'Col·legi Sagrat Cor de Sarrià',
    'Carrer del Sagrat Cor, 25, 08034 Barcelona', '93 203 02 00',
    'recepcio@sagratcorsarria.com', 'Recepción: 08:00-18:30 sin interrupción.',
    'Miércoles por la noche: sede oficial del grupo.', 'https://sagratcorsarria.com/el-col-legi/',
    'https://www.google.com/maps/search/?api=1&query=Collegi+Sagrat+Cor+de+Sarria',
    'https://www.css.cat/wp-content/uploads/2016/07/Pista-futbol-Sagrat-Cor-Barcelona.jpg',
    'https://www.css.cat/es/instalacion-sagrat-cor/',
    'Cancha de césped artificial dentro del colegio y sede oficial de los partidos del miércoles.'
),
(
    'cf-barceloneta', 'Camp de Futbol Municipal Parc de la Catalana',
    'Carrer del Doctor Aiguader, 58, 08003 Barcelona', '93 221 25 09',
    'oficina.esportiva@cfbarceloneta.com', 'Lunes a viernes 15:00-22:00.',
    'Algunos sábados, como sede excepcional.', 'https://cfbarceloneta.com/',
    'https://www.google.com/maps/place/CF+Barceloneta/@41.38319,2.1890708,17z/',
    'https://www.europlan-online.de/files/519e7fbcd2bb0d9733316215d3ff005f.jpg',
    'https://www.europlan-online.de/la-catalana/stadion-80529.html',
    'Campo municipal de césped artificial en la Barceloneta, alternativa ocasional para el grupo del sábado.'
);

INSERT INTO competition_venues (competition_id, venue_id, role, display_order)
SELECT c.id, v.id, 'primary', 1 FROM competitions c, venues v
WHERE c.slug='bogatell' AND v.slug='cem-bogatell';
INSERT INTO competition_venues (competition_id, venue_id, role, display_order)
SELECT c.id, v.id, 'alternate', 2 FROM competitions c, venues v
WHERE c.slug='bogatell' AND v.slug='cf-barceloneta';
INSERT INTO competition_venues (competition_id, venue_id, role, display_order)
SELECT c.id, v.id, 'primary', 1 FROM competitions c, venues v
WHERE c.slug='sarria' AND v.slug='sagrat-cor-sarria';

INSERT INTO venue_facts (venue_id, category, fact_text, display_order)
SELECT id, 'funny', 'El fernet está tan caro que casi parece un Johnnie Walker Blue Label.', 1 FROM venues WHERE slug='cem-bogatell';
INSERT INTO venue_facts (venue_id, category, fact_text, display_order)
SELECT id, 'funny', 'Jordi puede empezar a contar historias sexuales a los dos minutos de conversación.', 2 FROM venues WHERE slug='cem-bogatell';
INSERT INTO venue_facts (venue_id, category, fact_text, display_order)
SELECT id, 'funny', 'Cada tanto llega un correo con instrucciones para usar las instalaciones como si el grupo tuviera antecedentes.', 3 FROM venues WHERE slug='cem-bogatell';
INSERT INTO venue_facts (venue_id, category, fact_text, display_order)
SELECT id, 'funny', 'El agua de los vestuarios sale hirviendo en verano y en invierno; nunca a una temperatura disfrutable.', 1 FROM venues WHERE slug='sagrat-cor-sarria';
INSERT INTO venue_facts (venue_id, category, fact_text, display_order)
SELECT id, 'useful', 'No hay bares cerca y el bar interior suele cerrar durante el verano.', 1 FROM venues WHERE slug='cf-barceloneta';
INSERT INTO venue_facts (venue_id, category, fact_text, display_order)
SELECT id, 'useful', 'El campo se siente un poco más ancho que Bogatell.', 2 FROM venues WHERE slug='cf-barceloneta';
INSERT INTO venue_facts (venue_id, category, fact_text, display_order)
SELECT id, 'funny', 'La pelota a veces termina fuera de la cancha.', 3 FROM venues WHERE slug='cf-barceloneta';
