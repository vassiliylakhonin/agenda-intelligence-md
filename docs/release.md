# Release Notes for Maintainers

## Artifact Policy

This repository is source-only. Generated package artifacts must not be
committed:

- `dist/*`
- `build/*`
- `*.egg-info/*`

The normal CI workflow enforces this with `git ls-files` and fails if generated
artifacts become tracked again. Build outputs can still be created locally; they
are ignored by git and should be regenerated from source when needed.

## Pre-release Checks

Before publishing, the pull-request CI verifies the package path, not only the
editable development install:

- install package build tools;
- run the normal test, lint, type-check, CLI, docs, and example validation
  checks;
- build source distribution and wheel with `python3 -m build`;
- check package metadata with `python3 -m twine check dist/*`;
- install the built wheel into a fresh smoke-test virtual environment;
- verify `agenda-intelligence --version` and `agenda-intelligence
  validate-manifest`.

For a local release sanity check, run:

```bash
python3 -m pip install build twine
python3 -m pytest --maxfail=1 --disable-warnings -q
python3 scripts/validate.py
python3 scripts/validate_public_examples.py
python3 -m build
python3 -m twine check dist/*
```

## Evidence Assembly Release Check

Before a release that changes response assembly, reports, validators, or
packaged skills, confirm:

- public endpoints and reports use the shared evidence assembly path when one
  exists, rather than re-reading raw source arrays ad hoc;
- protected or internal-only evidence cannot appear in public JSON, rendered
  reports, package mirrors, or examples;
- presentation renderers can add visible output fields but cannot mutate route,
  score, verdict, evidence, or contract fields;
- contract fixtures either remain byte-for-byte stable or are regenerated with
  an explicit migration note.

## PyPI Publishing

The release workflows currently publish with the GitHub secret `PYPI_API_TOKEN`.

They are also prepared for PyPI Trusted Publishing through GitHub OIDC once the PyPI-side publisher is configured.

Repository-side requirements are already configured:

- `.github/workflows/release.yml` grants `id-token: write`.
- `.github/workflows/publish.yml` grants `id-token: write`.
- Both workflows use `pypa/gh-action-pypi-publish@release/v1`.
- Both workflows clean `dist/` and `build/` before building.
- Both workflows build release artifacts from the checked-out source tree.
- Both workflows currently pass `password: ${{ secrets.PYPI_API_TOKEN }}` so releases continue working before PyPI Trusted Publishing is enabled.
- Both workflows set `attestations: false` while token publishing is active. PEP 740 attestations only work with PyPI Trusted Publishing.

Release entry points:

- Push a version tag matching `v*` to run `.github/workflows/release.yml`.
- Run `.github/workflows/publish.yml` manually when a manual PyPI publish is
  needed.

One-time PyPI setup is still required in the PyPI project settings:

| Field | Value |
|---|---|
| Owner | `vassiliylakhonin` |
| Repository | `agenda-intelligence-md` |
| Workflow filename | `release.yml` |
| Environment name | leave empty unless a GitHub environment is added |

If manual publishing should also use Trusted Publishing, add a second PyPI trusted publisher with workflow filename `publish.yml`.

After setup, remove the `password: ${{ secrets.PYPI_API_TOKEN }}` input from the publish steps and set `attestations: true`. Then the `PYPI_API_TOKEN` secret is no longer required for these workflows.

## Release Smoke

`post-release-smoke.yml` installs the published PyPI package and verifies:

- `agenda-intelligence --version`
- packaged manifest version
- `validate-brief`
- `validate-evidence`
- `score --evidence`
- `doctor --strict`
- MCP config and stdio server smoke checks

It runs after a successful `Release` workflow and can also be run manually with a package version.
