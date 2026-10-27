# Viscalads web application

Local React/Vinext interface for the Viscalads SQLite history. Sarrià and
Bogatell share player identities but keep matches and statistics isolated.

For a clean installation, read [Local installation and usage](../docs/local-setup.md).
For the administrator workflow, read [Tournament operations](../docs/tournaments.md).
The project architecture, data rules and API surface are documented in the
[main README](../README.md).

## Development

Requirements: Node.js 22.13.0 or newer, pnpm 10 or newer, and the repository's
Python environment.

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the API at `http://127.0.0.1:8765` and the interface at
`http://localhost:3000`. The processes can be started separately with:

```bash
pnpm api
pnpm dev:web
```

The live interface requests `GET /api/stats`; it does not read
`lib/stats-data.json`. That JSON file is retained only for compatibility and
offline reports.

## Important modules

- `app/page.tsx`: application entry point and competition/view routing.
- `lib/stats-context.tsx`: live API loading and shared payload types.
- `components/stats-dashboard.tsx`: dashboard and section composition.
- `components/team-builder.tsx`: selection, WhatsApp import, team proposal and explanations.
- `lib/team-balancer.ts`: pure formation, rating, chemistry and leader-balancing algorithm.
- `lib/leader-race.ts`: tournament progress and detached-leader weighting.
- `lib/prematch-facts.ts`: verified, team-aware prematch facts.
- `components/match-entry.tsx`: match, guest and goal entry.

The team builder receives competition-specific current levels calculated by the
API, profile positions and verified match history. It supports five-, six- and
eight-player formations, distributes goalkeepers, limits chemistry influence,
and progressively separates a detached leading group from 40% of a tournament.

Temporary guests require a manual level from 1 to 10 and can have an optional
position. They participate in balancing and recent lineup presets but never
become players or receive personal statistics.

## Checks

```bash
pnpm test
pnpm build
pnpm lint
```

The tests cover balancing, leader separation, ratings, achievements, prematch
facts, WhatsApp parsing and tournament dates. The backend suite is run from the
repository root with `make test`.
