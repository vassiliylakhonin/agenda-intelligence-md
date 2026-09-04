.PHONY: install test package-consistency lint format typecheck worker-test update-contract-responses ts-client ts-client-check smoke-live ci ci-fast verify-local verification-report clean build publish

# Python interpreter used by the test/CI targets. Override per invocation when
# the default `python3` points at an interpreter without the dev deps installed
# (e.g. a fresh system upgrade). Activating `.venv` is equivalent.
#
#   make ci PYTHON=.venv/bin/python
#   make test PYTHON=python3.12
PYTHON ?= python3
export PYTHONPATH := $(CURDIR)/src:$(PYTHONPATH)

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

# Fast documentation/package-version invariant. Run first in pre-push so stale
# README install commands fail before the broader test suite starts.
package-consistency:
	$(PYTHON) -m pytest tests/test_package_consistency.py -q

# Worker-side regression surface for the deployed A2A wrapper.
worker-test:
	cd deploy/cloudflare-worker && npm test

# Regenerate public contract response fixtures from the Python service layer.
update-contract-responses:
	$(PYTHON) scripts/update_contract_responses.py

# Regenerate the TypeScript client from schemas/v1. The checked-in output is
# the published package, so this runs on every schema change.
ts-client:
	$(PYTHON) scripts/generate_ts_client.py

ts-client-check:
	$(PYTHON) scripts/generate_ts_client.py --check

# Networked post-deploy smoke. Kept out of CI because it depends on live Workers.
smoke-live:
	cd deploy/cloudflare-worker && npm run smoke:live

# Python/package pre-push gate. Mirrors what GitHub Actions runs.
# Run `make ci` before Python/package pushes to avoid the staircase of CI fixes.
ci: lint typecheck test ts-client-check
	$(PYTHON) -m compileall src scripts tests
	$(PYTHON) -m agenda_intelligence.cli --help >/dev/null
	$(PYTHON) -m agenda_intelligence.cli validate-manifest >/dev/null
	$(PYTHON) -m agenda_intelligence.cli validate-brief examples/agenda-brief.json >/dev/null
	$(PYTHON) -m agenda_intelligence.cli validate-evidence examples/source/evidence-pack.json >/dev/null
	$(PYTHON) -m agenda_intelligence.cli memory-lint --format json >/dev/null
	$(PYTHON) -m agenda_intelligence.cli memory-search sanctions >/dev/null
	$(PYTHON) -m agenda_intelligence.cli memory-search-bench tests/fixtures/analysis_bank_retrieval/manifest.json --format json >/dev/null
	$(PYTHON) -m agenda_intelligence.cli memory-applicability-bench tests/fixtures/analysis_bank_applicability/manifest.json --format json >/dev/null
	$(PYTHON) -m agenda_intelligence.cli memo-quality-bench tests/fixtures/memo_quality --format json >/dev/null
	$(PYTHON) -m agenda_intelligence.cli weekly-delta-bench tests/fixtures/weekly_delta --format json >/dev/null
	$(PYTHON) scripts/validate.py
	$(PYTHON) scripts/validate_public_examples.py
	$(PYTHON) scripts/smoke_mcp.py --command "$(PYTHON) -m agenda_intelligence.mcp_stdio"

# Subset for tight inner loop (lint + tests, no CLI smoke).
ci-fast: lint typecheck test

# Full local gate before pushing changes that touch Worker discovery/runtime,
# package assets, examples, or validation guards.
verify-local: ci worker-test

# Run both local verification surfaces and write deterministic, machine-readable
# evidence. The report intentionally excludes timestamps, durations, and host paths.
verification-report:
	$(PYTHON) scripts/verify_repository.py --output .verification/results.json

clean:
	find . -type f -name '*.pyc' -delete
	find . -type d -name '__pycache__' -delete
	rm -rf build/ dist/ *.egg-info

build:
	python -m build

publish: build
	twine upload dist/*
