# Viscalads

Viscalads is a local-first football history, statistics and balanced-team project reconstructed from football-group records. It currently keeps Sarrià (Wednesdays) and Bogatell (Saturdays) as separate competitions while sharing one global player identity. SQLite is the operational source of truth; the live API payload and optional JSON snapshots are derived outputs.

The repository is private by design. Original WhatsApp exports, private media and OCR scratch files must never be committed. Curated competition and player images used by the interface live under `web-stats/public/` and may be versioned deliberately.

Current tagged release: `v1.4.0`. It adds own-goal entry, richer moment-based prematch facts, WhatsApp list parsing and copy-ready output, cumulative tournament rules, progressively stronger leader separation in the team builder, and the latest verified Sarrià history. The current branch also contains the tournament-code matching fix used by leader detection.

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

For a clean machine, follow [Local installation and usage](docs/local-setup.md).
For the administrator workflow, follow [Tournament operations](docs/tournaments.md).

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

The web application requires Node.js `22.13.0` or newer. `pnpm dev` starts both
the Python API on `http://127.0.0.1:8765` and the Vinext interface on
`http://localhost:3000`. To run them separately, use `pnpm api` and
`pnpm dev:web` from `web-stats/`.

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

1. From a competition dashboard, **Guardar partido jugado** starts with empty teams.
2. The user can add players manually or request `GET /api/lineups` and select
   one of the five latest generated formations as a shortcut. Nothing is loaded
   automatically and the selected formation remains editable.
3. The current tournament is selected by default; the user can choose a different edition when entering a historical match. The UI sends the tournament, date, two rosters and goals to `POST /api/matches`.
4. `services.match_entry.save_match` validates the date, competition
   membership, unique participants, guests and scorers.
5. The service derives both scores and the result from the goals, selects the
   selected tournament (which must belong to the current competition) and writes the match, rosters, guests,
   known scorers, evidence and audit event in one SQLite transaction.
6. The browser reloads `/api/stats`; every table immediately reflects the new
   database state without rebuilding static assets.

Goals without an author count toward the team score but do not create a scorer
record. An own goal is credited to the opposing team's score, is stored with its
author for auditability, and never increases that player's personal goal total.
Temporary guests exist only inside that match.

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

The builder can also parse a pasted WhatsApp list. Only explicit `IN` markers
confirm availability. It recognizes common numbering, spacing, casing, invisible
characters, aliases and dividers; ambiguous names remain unresolved instead of
being guessed. Vacant starter places are filled from confirmed reserves before
rotation is evaluated, and the resulting starter/reserve order can be copied
back in WhatsApp-ready text.

## Web features

- Competition home screen with direct access to statistics, standings, tournaments, match-day tools, players and venues.
- Individual ranking by points, effectiveness, wins, losses and matches played.
- Minimum and maximum appearance filters.
- Current form over recent matches, a 95-day continuity window and explicit inactivity handling.
- Decisive-player and collective-jinx comparisons.
- Teammate, rival, pair and trio analysis.
- Tournament performance, player prime, match history, records, coverage and honours.
- Player comparison with skill and performance graphics, plus an expandable rating-evolution chart.
- Balanced-team builder using each player's competition-specific current moment inside their global rating range, primary/secondary positions, goalkeeper distribution and verified pair chemistry.
- Tournament-aware leader distribution from 40% of the scheduled dates onward. A detached leading group requires a gap of at least one win (3 points); its influence grows toward the final dates and eventually takes priority over a marginally better level balance while preserving valid formations.
- Friendly mode for balanced teams without saving competitive statistics or generating competitive prematch facts.
- Local player photos with initials as the fallback.
- Player profile cards with personal and football information.
- Competition-scoped player directory with large profile cards and audited editing of identity, personal details, positions, active status and global rating range.
- Player achievement showcase rebuilt dynamically from verified history. Achievements aggregate tournament editions inside the selected competition, but never mix Sarrià with Bogatell. It includes 60/100 appearances, Champion and undefeated-champion patches, winning and unbeaten streak levels, goals, attendance, partnerships, nemeses and sustained Prime Moment appearances; removed or unverified matches cannot award a patch. The team-builder preview can also identify a verified patch threshold that the proposed match may unlock or improve.
- Dedicated venue section with official/alternate grounds, practical information and Google Maps links.
- Date-aware venue galleries for team, match and celebration photos.
- Formation-aware five-, six- and eight-player teams. Six-a-side uses two defenders, at least two midfielders and one or two forwards; eight-a-side uses three defenders, at least three midfielders and one or two forwards. Goalkeepers are distributed when available.
- Dynamic SQLite-backed statistics with no manual web-data refresh.
- Manual match entry with editable teams, temporary guests, regular/anonymous/own goals, goal-derived results and auditable corrections.
- The five most recent generated lineups available as match-entry presets.
- Tournament history with clickable match results, dynamically calculated champions and newest-first ordering. Open tournaments expose leaders but never prematurely award champion patches or trophies.
- Tournament standings with played/won/drawn/lost, recorded goals, base points, bonus/penalty matches and final points. Recently active players can appear with zero matches in an open edition; players absent from the competition for more than 90 days are omitted from that zero-match pool.
- Tournament creation from a start date and number of weekly matchdays; the closing date is previewed weekly, names advance automatically from the latest numbered edition, and the selected rule is immutable after creation.

## Data rules

- A player has one immutable numeric ID and one canonical display name.
- Player photos are local public assets referenced by `players.photo_path`; an empty value deliberately falls back to initials.
- A tournament must belong to a competition; matches inherit that competition through their tournament.
- Alternate spellings belong in `player_aliases`; they never create another player.
- Participation is one row per player and match in `match_players`.
- A verified match requires two non-empty teams and a known win/draw/loss outcome.
- An exact score must agree with the recorded outcome.
- A regular goal must belong to the scorer's team. An own goal must be authored by a player on the opposite side from the team receiving the goal; only regular goals count toward personal scoring statistics.
- Evidence is linked to a match as a separate record and can later carry message IDs, file hashes and confidence.
- Corrections are recorded in `audit_events` rather than silently replacing history.
- Generated files are disposable and must be reproducible from SQLite.
- Historical CSV files are decommissioned and cannot rebuild or overwrite the database.
- A player has one position-independent level range in `player_rating_ranges`. The current level uses the latest 10 verified matches from the selected competition, crossing tournament editions but never mixing Sarrià with Bogatell. It changes only through played matches (plus the separate consecutive-absence penalty), never because individual matches expire silently. A continuous playing spell remains valid while gaps between appearances do not exceed 95 days. After more than 95 days without playing, the moment is marked stale and matchmaking uses the range midpoint; returning starts a new spell. With fewer than 5 matches in that spell the level stays at the midpoint; with 5 to 9, missing matches are neutral (0.5). A win scores 1, a draw 0.5 and a loss 0, and the result is always bounded by the configured range.
- WhatsApp lineup rotation normally protects players until they have accumulated two consecutive appearances in the current tournament. The only exception is matchday two: after exactly one verified tournament match, opening-day players with one appearance may be rotated out for confirmed reserves with zero appearances. Reserves enter in list order; outgoing players are ordered by the longest streak and exact ties are decided randomly.
- Tournament rules are stored with the edition and cannot be changed afterward. Supported presets are no special rule, a one-point penalty for losing by at least three goals, and cumulative `+1/−1` points for every complete three-goal band. These adjustments affect only that tournament table and totals may be negative.
- Tournament tables order by final points, wins, participation state/count, recorded goals and finally name. This ordering improves table visibility; closed-edition champions are every player tied on the highest final-points total, independent of display order.
- Leader separation uses tournament codes internally and display names only in the UI. It starts at 40% of scheduled matchdays, considers any detached leading group (not only the first player), distributes both headcount and rank weight, and becomes decisive near the end of the tournament.

## Local API

The development API intentionally exposes a small JSON surface:

- `GET /api/stats`: complete live payload derived from SQLite.
- `GET /api/lineups?competition=<slug>`: five latest generated formations.
- `POST /api/lineups`: save a competitive generated formation.
- `POST /api/lineups/parse`: parse and rotate a pasted WhatsApp list.
- `POST /api/matches` and `PUT /api/matches/:id`: create or correct a match.
- `DELETE /api/matches/:id`: soft-void a match with an audit reason.
- `POST /api/players`, `PUT /api/players/:id`, `DELETE /api/players/:id`: maintain competition-scoped player membership and details.
- `POST /api/players/:id/reactivate`: restore a player's competition membership.
- `POST /api/tournaments`: create a weekly tournament with its immutable rule.

All responses are JSON, live requests are non-cacheable, and the local server
accepts browser requests only from `http://localhost:3000`.

## Routine update

Future matches can be entered through **Guardar partido jugado**. The local API writes
them directly to SQLite; goal totals determine the score and outcome. Guests
belong only to that match and are excluded from individual statistics.

Run `viscalads audit` after bulk imports or direct maintenance. The legacy
`web-stats/lib/stats-data.json` export is retained only for offline reports and
compatibility; the live interface does not read it.

The scripts under `scripts/` are migration/import utilities, not the routine entry point for new matches. Run them only against an intentional backup or disposable copy unless their effect has been reviewed.

## Tests

```bash
make test
# equivalent without installing the package:
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

The database/workflow tests clone the real database into a temporary file and
never alter the authoritative history. Statistics unit tests use small synthetic
matches with fully explicit expected results, making calculation failures easy
to locate.

The suite covers database integrity, known historical corrections, competition
isolation, query arithmetic, tournament creation and explicit assignment, pairs, trios, verification rules,
large-team behavior, goal-derived outcomes, anonymous goals, guests, invalid
cross-competition players, editing, audit-preserving annulment and the latest-five
formation policy. A production web build can be checked with:

```bash
pnpm --dir web-stats build
pnpm --dir web-stats test
pnpm --dir web-stats lint
```

## Backups and versioning

The SQLite file is authoritative and versioned in the private repository. `viscalads snapshot` also writes deterministic JSON under `data/snapshots/` so corrections remain human-reviewable. Database migrations are append-only.
