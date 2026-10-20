# Offline security audit environment

This environment builds **this source checkout**, not an installed release. It
contains source and test dependencies for an offline security review. It does not
contain production credentials or evidence of current production configuration.

From the repository root, with Docker available:

```sh
docker build --platform linux/amd64 -f .oss-scanner/Dockerfile -t agenda-oss-scanner .
docker run --rm --platform linux/amd64 --network none agenda-oss-scanner sh .oss-scanner/check-offline.sh
# Optional interactive review, also with no network:
docker run --rm -it --platform linux/amd64 --network none agenda-oss-scanner bash
```

Dependency downloads run only during the online build. Tests run without network,
host mounts, API keys or deployment credentials. The root `.dockerignore` excludes
Git metadata, local secrets, private outputs and generated dependency/build trees.
Use a clean checkout as build context. The pinned base image and Linux amd64 target
match the tested audit environment; this is not a runtime image or release tag.

The offline check runs `make verify-local`, a source wheel build and `forge test --offline -v` (including escrow invariants).

Do not run live smoke tests, publication, remote migrations, deploy commands or
upstream data synchronization as part of the offline check. Wrangler bundling in
Vizier uses `--dry-run`; contract tests in Agenda do not fork a live chain.

The [threat model](threat_model.md) records architecture at its footer source
revision, effective resources, conditional trust assumptions and severity context.
It identifies investigation questions rather than validated vulnerabilities. The
existing analytical threat model, where present, is a separate document.

## Enrollment status

Files are prepared for Anthropic OSS Scanner. Preparation, passing tests and
signed cards do not mean enrollment, acceptance, completed scanning or security
certification. Enrollment is a separate public request, subject to maintainer
approval, program terms and Anthropic's case-by-case eligibility review. Do not
claim adoption, users or dependents without supporting evidence.

The official `tools/check` also installs Claude Code. A direct Docker build plus
network-disabled tests is recorded separately and is not claimed as a completed
`tools/check` run.
