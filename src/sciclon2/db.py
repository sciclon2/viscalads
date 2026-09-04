from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import MIGRATIONS_DIR


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


@contextmanager
def transaction(connection: sqlite3.Connection):
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    else:
        connection.commit()


def migrate(connection: sqlite3.Connection, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    connection.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations "
        "(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    applied = {row[0] for row in connection.execute("SELECT version FROM schema_migrations")}
    completed: list[str] = []
    for migration in sorted(migrations_dir.glob("*.sql")):
        if migration.name in applied:
            continue
        connection.executescript(migration.read_text(encoding="utf-8"))
        connection.execute("INSERT INTO schema_migrations(version) VALUES (?)", (migration.name,))
        connection.commit()
        completed.append(migration.name)
    connection.execute("PRAGMA optimize")
    return completed

