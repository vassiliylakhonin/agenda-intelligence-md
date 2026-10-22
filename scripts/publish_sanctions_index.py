#!/usr/bin/env python3
"""Build, gate, and optionally publish the sanctions name index.

Running without ``--publish`` is a safe rehearsal: it downloads every declared
official source, validates the rebuilt compact index, compares it with the
currently served snapshot, and prints the candidate SHA-256. Production changes
only when the operator explicitly adds ``--publish`` from a clean ``main``
checkout authenticated with Wrangler.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parents[1]
COMPACT_INDEX = ROOT / "deploy" / "snapshot-site" / "sanctions-name-index-compact.json"
SNAPSHOT_DIRECTORY = ROOT / "deploy" / "snapshot-site"
PUBLISHED_URL = "https://sanctions-name-index.pages.dev/sanctions-name-index-compact.json"
WRANGLER_VERSION = "4.122.0"
POST_DEPLOY_ATTEMPTS = 12
POST_DEPLOY_PAUSE_SECONDS = 10
PAGES_AUTH_MAX_BYTES = 65536


def run_command(
    command: Sequence[str], *, check: bool = True, capture_output: bool = False
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(command),
        cwd=ROOT,
        check=check,
        capture_output=capture_output,
        text=True,
    )


def require_clean_main() -> None:
    branch = run_command(["git", "branch", "--show-current"], capture_output=True).stdout.strip()
    dirty = run_command(["git", "status", "--porcelain"], capture_output=True).stdout.strip()
    problems: list[str] = []
    if branch != "main":
        problems.append(f"current branch is {branch!r}, expected 'main'")
    if dirty:
        problems.append("tracked or untracked source changes are present")
    if problems:
        raise RuntimeError("production publish refused: " + "; ".join(problems))


def prepare_candidate() -> str:
    run_command([sys.executable, "scripts/sanctions_name_index.py"])
    run_command([sys.executable, "scripts/verify_sanctions_index.py", str(COMPACT_INDEX.relative_to(ROOT))])
    run_command(
        [
            sys.executable,
            "scripts/gate_sanctions_index_publish.py",
            "--candidate",
            str(COMPACT_INDEX.relative_to(ROOT)),
            "--published",
            PUBLISHED_URL,
            "--max-name-drift-ratio",
            "0.10",
        ]
    )
    digest = hashlib.sha256(COMPACT_INDEX.read_bytes()).hexdigest()
    print(f"candidate compact SHA-256: {digest}")
    return digest


def print_decision_workspace(digest: str) -> None:
    print("decision workspace:")
    print("  goal: refresh the public name-screening snapshot from four declared official sources")
    print(f"  trusted evidence: clean main checkout; gated candidate SHA-256 {digest}")
    print("  suspected unreliable evidence: anything rejected by the source, shape, canary, or drift gates")
    print("  hidden assumptions: Cloudflare serves uploaded static bytes unchanged at the canonical Pages URL")
    print("  intended next action: publish only deploy/snapshot-site to the sanctions-name-index Pages project")
    print("  stop or escalate if: auth failure, gate failure, hash mismatch, or post-deploy mismatch")


class RejectPagesAuthRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def pages_auth_opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(RejectPagesAuthRedirects())


def verify_pages_token(token: str) -> None:
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", account):
        raise RuntimeError("Pages token requires an explicit Cloudflare account ID (32 hexadecimal characters)")
    if not token or any(character.isspace() for character in token):
        raise RuntimeError("Pages token is empty or malformed")
    request = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/sanctions-name-index",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    try:
        with pages_auth_opener().open(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError(f"Pages project authentication refused (HTTP {response.status})")
            raw = response.read(PAGES_AUTH_MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        # Never log an API response, redirect target, or credential-bearing request.
        raise RuntimeError(f"Pages project authentication refused (HTTP {exc.code})") from None
    except (urllib.error.URLError, OSError):
        raise RuntimeError("Pages project authentication request failed") from None
    if len(raw) > PAGES_AUTH_MAX_BYTES:
        raise RuntimeError("Pages project authentication metadata exceeds the size limit")
    try:
        payload = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError("Pages returned malformed authentication metadata") from None
    project = payload.get("result") if isinstance(payload, dict) else None
    if (
        not isinstance(payload, dict)
        or payload.get("success") is not True
        or not isinstance(project, dict)
        or project.get("name") != "sanctions-name-index"
        or project.get("subdomain") != "sanctions-name-index.pages.dev"
    ):
        raise RuntimeError("Pages authentication did not confirm the expected sanctions-name-index project")
    print("Pages token authenticated for the expected sanctions-name-index project")


def verify_wrangler_auth() -> None:
    run_command(["npx", "--yes", f"wrangler@{WRANGLER_VERSION}", "--version"])
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if token is not None:
        verify_pages_token(token)
        return
    # Local OAuth publication retains the unambiguous-account requirement.
    result = run_command(
        ["npx", "--yes", f"wrangler@{WRANGLER_VERSION}", "whoami", "--json"],
        capture_output=True,
    )
    try:
        payload = json.loads(result.stdout)
    except (TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Wrangler returned malformed authentication metadata") from exc
    accounts = payload.get("accounts") if isinstance(payload, dict) else None
    if not isinstance(accounts, list) or len(accounts) != 1:
        count = len(accounts) if isinstance(accounts, list) else 0
        raise RuntimeError(f"Wrangler must expose exactly one Cloudflare account; found {count}")


def publish_candidate(digest: str) -> None:
    verify_wrangler_auth()
    print_decision_workspace(digest)
    run_command(
        [
            "npx",
            "--yes",
            f"wrangler@{WRANGLER_VERSION}",
            "pages",
            "deploy",
            str(SNAPSHOT_DIRECTORY.relative_to(ROOT)),
            "--project-name=sanctions-name-index",
            "--branch=main",
            "--commit-dirty=true",
        ]
    )

    check_command = [
        sys.executable,
        "scripts/check_published_index.py",
        "--published",
        PUBLISHED_URL,
        "--max-age-days",
        "1",
        "--expected-sha256",
        digest,
    ]
    for attempt in range(1, POST_DEPLOY_ATTEMPTS + 1):
        result = run_command(check_command, check=False)
        if result.returncode == 0:
            print("gated sanctions-index publish completed and verified")
            return
        print(f"attempt {attempt}: canonical Pages URL has not converged yet")
        if attempt < POST_DEPLOY_ATTEMPTS:
            time.sleep(POST_DEPLOY_PAUSE_SECONDS)
    raise RuntimeError("deployment completed but production never served the exact gated artifact")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--publish",
        action="store_true",
        help="publish the gated candidate to production; omission is a build-and-gate rehearsal",
    )
    args = parser.parse_args()

    try:
        if args.publish:
            require_clean_main()
        digest = prepare_candidate()
        if not args.publish:
            print("dry run complete; production was not changed")
            print("re-run with --publish from a clean main checkout to deploy this workflow")
            return 0
        publish_candidate(digest)
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
