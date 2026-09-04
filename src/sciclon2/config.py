from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = PROJECT_ROOT / "data" / "sciclon2.sqlite3"
MIGRATIONS_DIR = PROJECT_ROOT / "migrations"
WEB_EXPORT = PROJECT_ROOT / "web-stats" / "lib" / "stats-data.json"
SNAPSHOT_DIR = PROJECT_ROOT / "data" / "snapshots"
