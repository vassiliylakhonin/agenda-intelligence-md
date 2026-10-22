#!/usr/bin/env python3
"""Stage the single verified compact index for the existing CIS Worker's assets.

Normal fleet releases restore unchanged canonical bytes with default urllib.
The explicit one-time bootstrap accepts only the pinned successful main watchdog
artifact, never a denied-URL identity fallback. Daily refreshes stage the newly
built candidate after all existing source and drift gates.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from check_published_index import fetch

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "deploy" / "snapshot-worker-assets"
FILENAME = "sanctions-name-index-compact.json"
PUBLISHED_URL = "https://sanctions-index.agendamcp.dpdns.org/" + FILENAME
BOOTSTRAP_RUN = "39755543609"
BOOTSTRAP_SHA256 = "82464686b3209b877202b31a22f3223bc4f75718d6fec3b69d5c310e6f4cee86"
MAX_BYTES = 10_000_000


def stage_bytes(raw: bytes, *, expected_sha256: str | None = None) -> str:
    digest = hashlib.sha256(raw).hexdigest()
    if not 0 < len(raw) <= MAX_BYTES:
        raise RuntimeError("snapshot asset exceeds size bounds")
    if expected_sha256 is not None and digest != expected_sha256:
        raise RuntimeError("snapshot asset differs from the approved exact SHA-256")
    data = json.loads(raw)
    if not isinstance(data, dict) or data.get("schema_version") != "sanctions-name-index-compact.v1":
        raise RuntimeError("snapshot asset has an unexpected schema")
    generated = datetime.fromisoformat(str(data.get("generated_at_utc", "")).replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    if generated.tzinfo is None or not timedelta(0) <= now - generated <= timedelta(days=3):
        raise RuntimeError("snapshot asset is stale, undated or in the future")
    entries = data.get("entries")
    if not isinstance(entries, list) or len(entries) != data.get("summary", {}).get("name_count"):
        raise RuntimeError("snapshot entries disagree with the declared name count")
    if ASSETS.is_symlink():
        raise RuntimeError("snapshot asset directory must not be a symlink")
    ASSETS.mkdir(parents=True, exist_ok=True)
    # Never upload a full index, metadata, source document, credential or symlink.
    if any(p.name != FILENAME or not p.is_file() or p.is_symlink() for p in ASSETS.iterdir()):
        raise RuntimeError("snapshot asset directory must contain only the compact JSON")
    temporary = ASSETS / FILENAME
    temporary.write_bytes(raw)
    try:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "verify_sanctions_index.py"), str(temporary)], check=True
        )
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    print(f"Worker snapshot asset SHA-256: {digest}")
    return digest


def stage_file(path: Path, *, expected_sha256: str | None = None) -> str:
    return stage_bytes(path.read_bytes(), expected_sha256=expected_sha256)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group()
    inputs.add_argument("--bootstrap-artifact", type=Path, help=f"explicit recovery artifact from run {BOOTSTRAP_RUN}")
    inputs.add_argument("--candidate", type=Path, help="candidate already accepted by the source and drift gates")
    parser.add_argument("--expected-sha256", help="required with --candidate")
    args = parser.parse_args()
    if bool(args.candidate) != bool(args.expected_sha256):
        parser.error("--candidate and --expected-sha256 must be provided together")
    try:
        if args.bootstrap_artifact is not None:
            stage_file(args.bootstrap_artifact / FILENAME, expected_sha256=BOOTSTRAP_SHA256)
        elif args.candidate is not None:
            stage_file(args.candidate, expected_sha256=args.expected_sha256)
        else:
            _data, raw = fetch(PUBLISHED_URL, 60, default_urllib=True)
            stage_bytes(raw)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"snapshot assets not staged: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
