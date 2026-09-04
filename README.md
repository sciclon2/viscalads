# Viscalads

Viscalads is a local-first football history and statistics project reconstructed from the New Kids on Sarrià WhatsApp group. SQLite is the operational source of truth; the web dataset, Excel workbook and Word register are derived outputs.

The repository is private by design. Original WhatsApp exports, photos, videos and OCR scratch files must never be committed.

## Architecture

```text
data/sciclon2.sqlite3  ← única fuente de verdad
        ↓ repositories + services
        ├── audit
        ├── web-stats/lib/stats-data.json
        ├── Excel
        └── Word
```

Core boundaries:

- `migrations/`: append-only database schema changes.
- `src/sciclon2/db.py`: connections, transactions and migrations.
- `src/sciclon2/repositories/`: SQL access; UI and exporters do not issue SQL.
- `src/sciclon2/services/`: statistics, validation and export payloads.
- `tests/`: database and business-rule regression tests.
- `web-stats/`: the existing local interface. Its JSON is generated, not edited.

Data is organized as `competitions → tournaments → matches`. A competition is
the recurring group or venue (for example, Sarrià on Wednesdays or Bogatell on
Saturdays); tournaments are its individual editions. Every tournament belongs
to one competition so histories and statistics can be filtered independently.

Players have one global identity in `players`. The `competition_players` join
table records whether that player participates in Sarrià, Bogatell, or both;
this prevents duplicate people while keeping each competition's matches and
statistics isolated.

## First setup

Python has no runtime dependencies outside the standard library.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
viscalads init
viscalads audit
viscalads export-web
```

Or run the complete reproducible pipeline:

```bash
make rebuild
```

Start the interface:

```bash
cd web-stats
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Data rules

- A player has one immutable numeric ID and one canonical display name.
- Player photos are local public assets referenced by `players.photo_path`; an empty value deliberately falls back to initials.
- A tournament must belong to a competition; matches inherit that competition through their tournament.
- Alternate spellings belong in `player_aliases`; they never create another player.
- Participation is one row per player and match in `match_players`.
- A verified match requires two non-empty teams and a known win/draw/loss outcome.
- An exact score must agree with the recorded outcome.
- Evidence is linked to a match as a separate record and can later carry message IDs, file hashes and confidence.
- Corrections are recorded in `audit_events` rather than silently replacing history.
- Generated files are disposable and must be reproducible from SQLite.
- Historical CSV files are decommissioned and cannot rebuild or overwrite the database.

## Routine update

For future matches, write through a repository/service command (the next planned module is `viscalads add-match`) and then run:

```bash
viscalads audit
viscalads export-web
```

Never edit `web-stats/lib/stats-data.json` manually.

## Tests

```bash
python -m unittest discover -s tests -v
```

The tests create temporary databases and do not alter the real history.

## Backups and versioning

The SQLite file is authoritative and versioned in the private repository. `viscalads snapshot` also writes deterministic JSON under `data/snapshots/` so corrections remain human-reviewable. Database migrations are append-only.
