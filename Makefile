.PHONY: install test lint format clean build publish

install:
	pip install -e ".[dev]"

test:
	pytest --maxfail=1 --disable-warnings -q

lint:
	flake8 src/ tests/ scripts/
	black --check --line-length=120 src/ tests/ scripts/
	isort --check-only --profile=black src/ tests/ scripts/

format:
	black --line-length=120 src/ tests/ scripts/
	isort --profile=black src/ tests/ scripts/

clean:
	find . -type f -name '*.pyc' -delete
	find . -type d -name '__pycache__' -delete
	rm -rf build/ dist/ *.egg-info

build:
	python -m build

publish: build
	twine upload dist/*
