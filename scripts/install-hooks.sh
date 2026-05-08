#!/usr/bin/env bash
# Install a local git pre-push hook that runs `make ci-fast`.
# Idempotent. Safe to re-run. Skip with `git push --no-verify`.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
HOOK="$ROOT/.git/hooks/pre-push"

cat > "$HOOK" <<'HOOK_EOF'
#!/usr/bin/env bash
# Pre-push gate. Mirrors the lint + type + test surface CI runs.
# Bypass intentionally with `git push --no-verify` if you know what you're doing.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if ! command -v make >/dev/null 2>&1; then
  echo "pre-push: make not found, skipping local CI" >&2
  exit 0
fi

echo "pre-push: running 'make ci-fast' (lint + typecheck + tests)..."
make ci-fast
HOOK_EOF

chmod +x "$HOOK"
echo "Installed pre-push hook at $HOOK"
echo "It runs: make ci-fast (flake8, black --check, isort --check, ruff, mypy, pytest)"
echo "Bypass with: git push --no-verify"
