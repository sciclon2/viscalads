from __future__ import annotations

import argparse
from pathlib import Path

from .config import DEFAULT_DB, SNAPSHOT_DIR, WEB_EXPORT
from .db import connect, migrate
from .services.audit import audit
from .services.export import write_snapshot, write_web_payload


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(prog="sciclon2")
    command.add_argument("--db", type=Path, default=DEFAULT_DB)
    subcommands = command.add_subparsers(dest="command", required=True)
    subcommands.add_parser("init")
    subcommands.add_parser("audit")
    export = subcommands.add_parser("export-web")
    export.add_argument("--output", type=Path, default=WEB_EXPORT)
    snapshot = subcommands.add_parser("snapshot")
    snapshot.add_argument("--output", type=Path, default=SNAPSHOT_DIR / "canonical.json")
    return command


def main() -> None:
    args = parser().parse_args()
    connection = connect(args.db)
    applied = migrate(connection)
    if args.command == "init":
        print(f"Database ready: {args.db} ({len(applied)} migrations applied)")
    elif args.command == "audit":
        errors = audit(connection)
        if errors:
            for error in errors:
                print(f"ERROR: {error}")
            raise SystemExit(1)
        print("PASS: database integrity, relationships and football rules are consistent")
    elif args.command == "export-web":
        write_web_payload(connection, args.output)
        print(f"Generated {args.output}")
    elif args.command == "snapshot":
        write_snapshot(connection, args.output)
        print(f"Generated {args.output}")
    connection.close()


if __name__ == "__main__":
    main()
