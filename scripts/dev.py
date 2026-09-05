#!/usr/bin/env python3
from __future__ import annotations

import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
api = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve_api.py")], cwd=ROOT)
web = subprocess.Popen([str(ROOT / "web-stats" / "node_modules" / ".bin" / "vinext"), "dev"], cwd=ROOT / "web-stats")


def stop(*_):
    for process in (web, api):
        if process.poll() is None:
            process.terminate()


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    raise SystemExit(web.wait())
finally:
    stop()
    api.wait(timeout=5)
