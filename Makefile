PYTHON ?= python3
DB ?= data/sciclon2.sqlite3

.PHONY: init audit export snapshot test rebuild web-build

init:
	PYTHONPATH=src $(PYTHON) -m sciclon2.cli --db $(DB) init

audit:
	PYTHONPATH=src $(PYTHON) -m sciclon2.cli --db $(DB) audit

export:
	PYTHONPATH=src $(PYTHON) -m sciclon2.cli --db $(DB) export-web

snapshot:
	PYTHONPATH=src $(PYTHON) -m sciclon2.cli --db $(DB) snapshot

test:
	PYTHONPATH=src $(PYTHON) -m unittest discover -s tests -v

rebuild: audit export snapshot test

web-build:
	cd web-stats && pnpm build
