# Release Notes for Maintainers

## PyPI Trusted Publishing

The release workflows are prepared for PyPI Trusted Publishing through GitHub OIDC.

Repository-side requirements are already configured:

- `.github/workflows/release.yml` grants `id-token: write`.
- `.github/workflows/publish.yml` grants `id-token: write`.
- Both workflows use `pypa/gh-action-pypi-publish@release/v1`.
- Both workflows clean `dist/` and `build/` before building.

One-time PyPI setup is still required in the PyPI project settings:

| Field | Value |
|---|---|
| Owner | `vassiliylakhonin` |
| Repository | `agenda-intelligence-md` |
| Workflow filename | `release.yml` |
| Environment name | leave empty unless a GitHub environment is added |

If manual publishing should also use Trusted Publishing, add a second PyPI trusted publisher with workflow filename `publish.yml`.

After setup, the `PYPI_API_TOKEN` secret is no longer required for these workflows.

## Release Smoke

`post-release-smoke.yml` installs the published PyPI package and verifies:

- `agenda-intelligence --version`
- packaged manifest version
- `validate-brief`
- `validate-evidence`
- `score --evidence`

It runs after a successful `Release` workflow and can also be run manually with a package version.
