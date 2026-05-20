.PHONY: install test lint format typecheck ci ci-fast clean build publish

# Python interpreter used by the test/CI targets. Override per invocation when
# the default `python3` points at an interpreter without the dev deps installed
# (e.g. a fresh system upgrade). Activating `.venv` is equivalent.
#
#   make ci PYTHON=.venv/bin/python
#   make test PYTHON=python3.12
PYTHON ?= python3

install:
	pip install -e ".[dev]"
	pip install ruff mypy flake8 black isort

# Auto-fix what we can.
format:
	black --line-length=120 src/ tests/ scripts/
	isort --profile=black src/ tests/ scripts/

# Same lint surface as .github/workflows/lint.yml — read-only.
lint:
	flake8 src/ tests/ scripts/ --max-line-length=120 --ignore=E203,W503
	black --check --line-length=120 src/ tests/ scripts/
	isort --check-only --profile=black src/ tests/ scripts/

# Same CI lint+type surface as .github/workflows/ci.yml — read-only.
typecheck:
	ruff check src/ scripts/ tests/
	mypy src/agenda_intelligence

test:
	$(PYTHON) -m pytest --maxfail=1 --disable-warnings -q

# Quick local pre-push gate. Mirrors what GitHub Actions runs.
# Run `make ci` before every push to avoid the staircase of CI fixes.
ci: lint typecheck test
	$(PYTHON) -m compileall src scripts tests
	$(PYTHON) -m agenda_intelligence.cli --help >/dev/null
	$(PYTHON) -m agenda_intelligence.cli validate-manifest >/dev/null
	$(PYTHON) -m agenda_intelligence.cli validate-brief examples/agenda-brief.json >/dev/null
	$(PYTHON) -m agenda_intelligence.cli validate-evidence examples/source/evidence-pack.json >/dev/null
	$(PYTHON) scripts/validate.py
	$(PYTHON) scripts/validate_public_examples.py
	$(PYTHON) scripts/smoke_mcp.py --command "$(PYTHON) -m agenda_intelligence.mcp_stdio"

# Subset for tight inner loop (lint + tests, no CLI smoke).
ci-fast: lint typecheck test

clean:
	find . -type f -name '*.pyc' -delete
	find . -type d -name '__pycache__' -delete
	rm -rf build/ dist/ *.egg-info

build:
	python -m build

publish: build
	twine upload dist/*
