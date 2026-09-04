#!/usr/bin/env python3
"""Compatibility wrapper: regenerate the web payload from canonical SQLite."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from sciclon2.config import DEFAULT_DB, WEB_EXPORT
from sciclon2.db import connect, migrate
from sciclon2.services.audit import audit
from sciclon2.services.export import write_web_payload


def main() -> None:
    connection = connect(DEFAULT_DB)
    migrate(connection)
    errors = audit(connection)
    if errors:
        raise SystemExit("Database audit failed:\n" + "\n".join(errors))
    write_web_payload(connection, WEB_EXPORT)
    connection.close()
    print(f"Generated {WEB_EXPORT} from {DEFAULT_DB}")


if __name__ == "__main__":
    main()
