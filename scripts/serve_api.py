#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sciclon2.config import DEFAULT_DB
from sciclon2.db import connect, migrate
from sciclon2.services.export import web_payload
from sciclon2.services.match_entry import recent_lineups, save_lineup, save_match, void_match


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:3000")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _send(self, value, status=200):
        self._headers(status)
        self.wfile.write(json.dumps(value, ensure_ascii=False).encode("utf-8"))

    def _body(self):
        size = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(size) or b"{}")

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            with connect(DEFAULT_DB) as connection:
                migrate(connection)
                if parsed.path == "/api/stats":
                    self._send(web_payload(connection))
                elif parsed.path == "/api/lineups":
                    competition = parse_qs(parsed.query).get("competition", [""])[0]
                    self._send(recent_lineups(connection, competition))
                else:
                    self._send({"error": "No encontrado"}, 404)
        except (ValueError, sqlite3.IntegrityError) as exc:
            self._send({"error": str(exc)}, 400)

    def do_POST(self):
        try:
            with connect(DEFAULT_DB) as connection:
                migrate(connection)
                body = self._body()
                if self.path == "/api/lineups":
                    item_id = save_lineup(connection, body["competition"], body["teams"])
                elif self.path == "/api/matches":
                    item_id = save_match(connection, body)
                else:
                    return self._send({"error": "No encontrado"}, 404)
                self._send({"id": item_id}, 201)
        except (ValueError, KeyError, sqlite3.IntegrityError) as exc:
            self._send({"error": str(exc)}, 400)

    def do_PUT(self):
        try:
            match_id = int(self.path.removeprefix("/api/matches/"))
            with connect(DEFAULT_DB) as connection:
                migrate(connection)
                self._send({"id": save_match(connection, self._body(), match_id)})
        except (ValueError, KeyError, sqlite3.IntegrityError) as exc:
            self._send({"error": str(exc)}, 400)

    def do_DELETE(self):
        try:
            match_id = int(self.path.removeprefix("/api/matches/"))
            with connect(DEFAULT_DB) as connection:
                migrate(connection)
                void_match(connection, match_id, self._body().get("reason", ""))
            self._send({"ok": True})
        except (ValueError, sqlite3.IntegrityError) as exc:
            self._send({"error": str(exc)}, 400)

    def log_message(self, format, *args):
        print(f"[api] {self.address_string()} {format % args}")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    print("Viscalads API: http://127.0.0.1:8765")
    server.serve_forever()
