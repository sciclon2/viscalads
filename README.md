# Viscalads

Viscalads is a local-first football history, statistics and balanced-team project reconstructed from football-group records. It currently keeps Sarrià (Wednesdays) and Bogatell (Saturdays) as separate competitions while sharing one global player identity. SQLite is the operational source of truth; the web dataset, Excel workbook and Word register are derived outputs.

The repository is private by design. Original WhatsApp exports, private media and OCR scratch files must never be committed. Curated competition and player images used by the interface live under `web-stats/public/` and may be versioned deliberately.

Current release: [`v1.0.0-beta.1`](https://github.com/sciclon2/viscalads/releases/tag/v1.0.0-beta.1). It is a beta pre-release: the dynamic database workflow and automated regression suite are operational, while the product continues to evolve through real use.

## Architecture

```text
Browser (React/Vinext)
        ↓ HTTP JSON
scripts/serve_api.py
        ↓ application services
src/sciclon2/services/
        ↓ repositories
src/sciclon2/repositories/
        ↓ SQL
data/sciclon2.sqlite3  ← única fuente de verdad
```

Core boundaries:

- `migrations/`: append-only database schema changes.
- `src/sciclon2/db.py`: connections, transactions and migrations.
- `src/sciclon2/repositories/`: SQL access; UI and exporters do not issue SQL.
- `src/sciclon2/services/`: statistics, validation and export payloads.
- `tests/test_database.py`: integrity and known-history regression tests.
- `tests/test_statistics.py`: deterministic unit tests for statistical queries.
- `tests/test_match_entry.py`: create, edit, validation, quick-load and void workflow tests.
- `web-stats/`: local interface, competition landing page, statistics, match entry and balanced-team builder.
- `scripts/`: controlled one-time importers for reconstructed data and curated player photos.

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

Start the dynamic API and interface together:

```bash
cd web-stats
pnpm install
pnpm dev
```

Then open `http://localhost:3000`. The Python API reads SQLite on every request;
the statistics page no longer depends on a generated JSON dataset.

The landing page presents the two competitions. Selecting Sarrià or Bogatell opens only that competition's dashboard. The header selector can switch between them, and **Inicio** returns to the landing page.

## End-to-end technical flow

### Reading statistics

1. The browser requests `GET /api/stats` from the local Python API.
2. `scripts/serve_api.py` opens SQLite and calls `services.export.web_payload`.
3. The export service asks `repositories.history` for matches, profiles,
   competitions, venues and champions. SQL remains inside the repository layer.
4. `services.statistics.build_statistics` receives ordinary match dictionaries
   and calculates the player, tournament, pair and trio aggregates in memory.
5. The API returns one JSON payload. React filters and presents that current
   payload; it does not read a manually maintained statistics file.
6. Switching competition selects its isolated `competitionStats[slug]` branch.

The main query contract is:

- played = wins + draws + losses;
- points = wins × 3 + draws;
- effectiveness = points / (played × 3);
- only matches with `coverage_status = verified` contribute to statistics;
- pairs and trios are counted only when both sides contain at most eight known
  players, avoiding combinations from exceptional oversized lists;
- guests can affect a match score but never receive personal statistics.

### Creating a match

1. From a competition dashboard, **Cargar partido** starts with empty teams.
2. The user can add players manually or request `GET /api/lineups` and select
   one of the five latest generated formations as a shortcut. Nothing is loaded
   automatically and the selected formation remains editable.
3. The UI sends the date, two rosters and goals to `POST /api/matches`.
4. `services.match_entry.save_match` validates the date, competition
   membership, unique participants, guests and scorers.
5. The service derives both scores and the result from the goals, selects the
   tournament edition for that date and writes the match, rosters, guests,
   known scorers, evidence and audit event in one SQLite transaction.
6. The browser reloads `/api/stats`; every table immediately reflects the new
   database state without rebuilding static assets.

Goals without an author count toward the team score but do not create a scorer
record. Temporary guests exist only inside that match.

### Editing or annulling a match

Editing existing data is intentionally separate from creation. **Partidos**
lists the competition's existing matches. Editing sends `PUT /api/matches/:id`;
the same validation and result calculation are reused, and the related roster,
guest and goal rows are replaced transactionally. Annulling sends
`DELETE /api/matches/:id`, which soft-voids the record and adds an audit event.
The historical row remains in SQLite but disappears from all live queries.

### Generated teams and quick load

The team builder stores a generated formation through `POST /api/lineups`.
SQLite retains only the five newest formations per competition. Quick load is
therefore persistent across browser restarts, competition-scoped and ordered
newest first; it is not browser cache.

## Web features

- Individual ranking by points, effectiveness, wins, losses and matches played.
- Minimum and maximum appearance filters.
- Current form over recent matches and an activity window.
- Decisive-player and collective-jinx comparisons.
- Teammate, rival, pair and trio analysis.
- Tournament performance, player prime, match history, records, coverage and honours.
- Balanced-team builder using player form and primary/secondary positions.
- Local player photos with initials as the fallback.
- Player profile cards with personal and football information.
- Dedicated venue section with official/alternate grounds, practical information and Google Maps links.
- Date-aware venue galleries for team, match and celebration photos.
- Eight-player-per-team formations with three defenders, at least three midfielders and a rotating goalkeeper.
- Dynamic SQLite-backed statistics with no manual web-data refresh.
- Manual match entry with editable teams, temporary guests, goal-derived results and auditable corrections.
- The five most recent generated lineups available as match-entry presets.

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

Future matches can be entered through **Cargar partido**. The local API writes
them directly to SQLite; goal totals determine the score and outcome. Guests
belong only to that match and are excluded from individual statistics.

Run `viscalads audit` after bulk imports or direct maintenance. The legacy
`web-stats/lib/stats-data.json` export is retained only for offline reports and
compatibility; the live interface does not read it.

The scripts under `scripts/` are migration/import utilities, not the routine entry point for new matches. Run them only against an intentional backup or disposable copy unless their effect has been reviewed.

## Tests

```bash
python -m unittest discover -s tests -v
```

The database/workflow tests clone the real database into a temporary file and
never alter the authoritative history. Statistics unit tests use small synthetic
matches with fully explicit expected results, making calculation failures easy
to locate.

The suite covers database integrity, known historical corrections, competition
isolation, query arithmetic, tournaments, pairs, trios, verification rules,
large-team behavior, goal-derived outcomes, anonymous goals, guests, invalid
cross-competition players, editing, audit-preserving annulment and the latest-five
formation policy. A production web build can be checked with:

```bash
pnpm --dir web-stats build
```

## Backups and versioning

The SQLite file is authoritative and versioned in the private repository. `viscalads snapshot` also writes deterministic JSON under `data/snapshots/` so corrections remain human-reviewable. Database migrations are append-only.
