#!/usr/bin/env python3
"""Run repository gates and emit deterministic machine-readable evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / ".verification" / "results.json"

CONTRACT_PATHS = (
    "Makefile",
    "pyproject.toml",
    "scripts/verify_repository.py",
    "scripts/validate.py",
    "scripts/validate_public_examples.py",
    "schemas/v1/evidence-packet-request.schema.json",
    "schemas/v1/evidence-packet-response.schema.json",
    "src/agenda_intelligence/cli.py",
    "src/agenda_intelligence/services.py",
    "src/agenda_intelligence/data/schemas/v1/evidence-packet-request.schema.json",
    "src/agenda_intelligence/data/schemas/v1/evidence-packet-response.schema.json",
    "deploy/cloudflare-worker/package.json",
    "deploy/cloudflare-worker/src/index.js",
    "deploy/cloudflare-worker/src/profiles.js",
    "deploy/cloudflare-worker/test/worker.test.js",
)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def build_contract_manifest(root: Path = ROOT) -> dict:
    files = []
    for relative_path in CONTRACT_PATHS:
        path = root / relative_path
        if not path.is_file():
            raise FileNotFoundError(f"verification contract file is missing: {relative_path}")
        files.append({"path": relative_path, "sha256": sha256_bytes(path.read_bytes())})
    return {
        "algorithm": "sha256",
        "digest": sha256_bytes(canonical_json_bytes(files)),
        "files": files,
    }


def run_check(check_id: str, display_command: list[str], command: list[str]) -> dict:
    print(f"\n==> {check_id}: {' '.join(display_command)}", flush=True)
    completed = subprocess.run(command, cwd=ROOT, check=False)
    return {
        "id": check_id,
        "command": display_command,
        "exitCode": completed.returncode,
        "status": "passed" if completed.returncode == 0 else "failed",
    }


def build_report(checks: list[dict], contract_manifest: dict) -> dict:
    passed = all(check["status"] == "passed" for check in checks)
    return {
        "schemaVersion": 1,
        "scope": "repository-verification",
        "result": "passed" if passed else "failed",
        "checks": checks,
        "contracts": contract_manifest,
        "executionBoundary": {
            "networkRequired": False,
            "paidApiCalls": 0,
        },
        "claimBoundary": {
            "level": "INTERNAL_TECHNICAL_ONLY",
            "establishes": [
                "the recorded repository gates passed for the hashed contract set",
                "the report can be reproduced without paid APIs",
            ],
            "doesNotEstablish": [
                "factual truth or source reliability",
                "external benchmark performance",
                "buyer demand, production adoption, or commercial value",
                "live deployment health",
            ],
        },
    }


def write_report(report: dict, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(canonical_json_bytes(report) + b"\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    checks = [
        run_check(
            "python-package-ci",
            ["make", "ci", "PYTHON=<current-python>"],
            ["make", "ci", f"PYTHON={sys.executable}"],
        ),
        run_check(
            "cloudflare-worker-tests",
            ["make", "worker-test"],
            ["make", "worker-test"],
        ),
    ]
    report = build_report(checks, build_contract_manifest())
    output = args.output if args.output.is_absolute() else ROOT / args.output
    write_report(report, output)
    print(f"\nverification result: {report['result']}")
    print(f"report: {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}")
    print(f"report sha256: {sha256_bytes(output.read_bytes())}")
    return 0 if report["result"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
