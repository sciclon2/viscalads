# Local installation and usage

This guide starts Viscalads locally from a clean checkout. The application has
two processes: a Python API backed by SQLite and a React/Vinext interface.

## Requirements

- Git.
- Python 3.11 or newer.
- Node.js 22.13.0 or newer.
- pnpm 10 or newer (`corepack enable` can provide it with recent Node releases).

No external database server is required. The authoritative database is
`data/sciclon2.sqlite3`.

## 1. Clone and enter the repository

```bash
git clone git@github.com:sciclon2/viscalads.git
cd viscalads
```

The repository is private, so the GitHub account or SSH key used for the clone
must have access.

## 2. Prepare Python

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

Initialize pending schema migrations and verify the database:

```bash
viscalads init
viscalads audit
```

`init` applies append-only migrations. It does not rebuild historical data.
`audit` should finish successfully before using the application.

## 3. Install the web dependencies

```bash
cd web-stats
pnpm install
```

## 4. Start the application

From `web-stats/`:

```bash
pnpm dev
```

This starts:

- API: `http://127.0.0.1:8765`
- Web: `http://localhost:3000`

Open `http://localhost:3000` in a browser. Keep the terminal running while the
application is in use. Stop both processes with `Ctrl+C`.

### Start the processes separately

Use two terminals when API and interface logs need to be inspected independently.

Terminal 1, from `web-stats/`:

```bash
pnpm api
```

Terminal 2, also from `web-stats/`:

```bash
pnpm dev:web
```

If the page remains on “Cargando SQLite”, first confirm that the API terminal is
still running and that `http://127.0.0.1:8765/api/stats` returns JSON.

## 5. Everyday use

1. Choose Sarrià or Bogatell on the landing page.
2. Use **Armar equipos** to paste a WhatsApp list or select players manually.
3. Use **Guardar partido jugado** after the match. Review the tournament, date,
   teams and goals before saving.
4. Use **Tabla** and **Torneos** to review the current edition and its history.
5. Use **Jugadores** for profiles, moment, achievements and comparisons.

Sarrià and Bogatell share player identities but keep matches, form, rotation,
standings and achievements isolated by competition.

## Verification and maintenance

From the repository root:

```bash
make audit
make test
pnpm --dir web-stats test
pnpm --dir web-stats build
```

Create a deterministic history snapshot before substantial manual maintenance:

```bash
make snapshot
```

Do not import WhatsApp source files or run one-time scripts as part of normal
match entry. The interface and API are the routine write path.

## Updating an existing checkout

Stop the local processes, then run:

```bash
git pull --ff-only
source .venv/bin/activate
python -m pip install -e .
viscalads init
cd web-stats
pnpm install
pnpm dev
```

Never replace `data/sciclon2.sqlite3` with an old copy merely to update the
application. Back it up before any intentional data correction.

