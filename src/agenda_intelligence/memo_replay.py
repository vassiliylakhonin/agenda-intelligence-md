"""Capture private memo outputs and rescore them offline against exact coverage."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from importlib import resources
from pathlib import Path
from typing import Any

from agenda_intelligence import __version__
from agenda_intelligence.product import _extract_json_object, check_memo_quality

STATUSES = {"completed", "truncated", "refused", "error"}


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _object(text: str) -> dict[str, Any]:
    value = _extract_json_object(text)
    if value is None:
        raise ValueError("Expected one JSON object with unique keys and finite numbers.")
    return value


def _key(row: dict[str, Any]) -> tuple[str, int]:
    case, sample = row.get("case_id"), row.get("sample_id")
    if not isinstance(case, str) or not case.strip() or type(sample) is not int or sample < 0:
        raise ValueError("Each record needs a nonempty case_id and a nonnegative integer sample_id.")
    return case, sample


def _expectations(rows: Any) -> dict[tuple[str, int], dict[str, Any]]:
    if not isinstance(rows, list) or not rows:
        raise ValueError("Expected a nonempty cases list.")
    result = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Each case must be an object.")
        key = _key(row)
        if key in result:
            raise ValueError("Duplicate expected case/sample key.")
        if any(type(row.get(field)) is not bool for field in ["expected_schema_valid", "expected_quality_ok"]):
            raise ValueError("Cases require explicit boolean schema and quality expectations.")
        result[key] = row
    return result


def capture(manifest_path: Path, run_dir: Path, *, revision: str) -> dict[str, Any]:
    """Save exact output text and provenance once; never execute a model or tool."""
    manifest_bytes = manifest_path.read_bytes()
    manifest = _object(manifest_bytes.decode("utf-8"))
    cases = manifest.get("cases")
    provenance: Any
    # Reuse the existing memo-quality corpus without maintaining a second case list.
    if "fixtures" in manifest and cases is None:
        cases = []
        fixtures = manifest["fixtures"]
        if not isinstance(fixtures, list):
            raise ValueError("Fixtures must be a list.")
        for fixture in fixtures:
            if not isinstance(fixture, dict) or not isinstance(fixture.get("path"), str):
                raise ValueError("Each fixture needs a path.")
            if fixture.get("expected_class") not in {"golden", "failure"}:
                raise ValueError("Unknown fixture expectation.")
            cases.append(
                {
                    "case_id": fixture["path"],
                    "sample_id": 0,
                    "raw_output_path": fixture["path"],
                    "expected_schema_valid": True,
                    "expected_quality_ok": fixture["expected_class"] == "golden",
                }
            )
        provenance = {"producer": "bundled_synthetic_fixtures", "model": "none", "prompt_revision": "not_applicable"}
    else:
        provenance = manifest.get("provenance")
    if not isinstance(provenance, dict) or any(
        not isinstance(provenance.get(key), str) or not provenance[key].strip()
        for key in ["producer", "model", "prompt_revision"]
    ):
        raise ValueError("Provenance must name producer, model and prompt_revision; use explicit unavailable labels.")
    expected = _expectations(cases)
    records, expected_rows = [], []
    for (case_id, sample_id), case in expected.items():
        status = case.get("status", "completed")
        if not isinstance(status, str) or status not in STATUSES:
            raise ValueError("Unknown output status.")
        output_path = case.get("raw_output_path")
        if output_path is None and status != "completed":
            raw = ""
        elif isinstance(output_path, str):
            raw = (manifest_path.parent / output_path).read_text(encoding="utf-8")
        else:
            raise ValueError("Completed cases require raw_output_path.")
        records.append(
            {
                "case_id": case_id,
                "sample_id": sample_id,
                "status": status,
                "raw_output": raw,
                "raw_sha256": _digest(raw.encode("utf-8")),
            }
        )
        expected_rows.append(
            {key: case[key] for key in ["case_id", "sample_id", "expected_schema_valid", "expected_quality_ok"]}
        )
    raw_bytes = ("\n".join(json.dumps(row, ensure_ascii=False, allow_nan=False) for row in records) + "\n").encode(
        "utf-8"
    )
    schema = resources.files("agenda_intelligence") / "data/schemas/v1/agenda-memo.schema.json"
    meta = {
        "contract_version": 1,
        "package_version": __version__,
        "capture_revision": revision,
        "provenance": provenance,
        "manifest_sha256": _digest(manifest_bytes),
        "schema_sha256": _digest(schema.read_bytes()),
        "raw_sha256": _digest(raw_bytes),
        "cases": expected_rows,
        "scope": "Private structural regression evidence; not factual truth, model quality or customer adoption.",
    }
    run_dir.mkdir(parents=True, exist_ok=False)
    (run_dir / "raw.jsonl").write_bytes(raw_bytes)
    (run_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return meta


def rescore(run_dir: Path, *, revision: str) -> dict[str, Any]:
    """No retrieval, model calls, signatures, payments or re-execution of actions."""
    meta = _object((run_dir / "meta.json").read_text(encoding="utf-8"))
    if type(meta.get("contract_version")) is not int or meta["contract_version"] != 1:
        raise ValueError("Unsupported replay contract version.")
    expected = _expectations(meta.get("cases"))
    raw_bytes = (run_dir / "raw.jsonl").read_bytes()
    integrity_ok = _digest(raw_bytes) == meta.get("raw_sha256")
    seen: Counter[tuple[str, int]] = Counter()
    invalid, scored = [], []
    for number, text in enumerate(raw_bytes.decode("utf-8").splitlines(), 1):
        try:
            row = _object(text)
            key = _key(row)
            status, raw = row.get("status"), row.get("raw_output")
            if (
                not isinstance(status, str)
                or status not in STATUSES
                or not isinstance(raw, str)
                or row.get("raw_sha256") != _digest(raw.encode("utf-8"))
            ):
                raise ValueError("Invalid output record or digest.")
        except ValueError:
            invalid.append(number)
            continue
        seen[key] += 1
        if key not in expected:
            continue
        parsed = _extract_json_object(raw) if status == "completed" else None
        if parsed is not None:
            checked = check_memo_quality(parsed)
            result = {
                "schema_valid": checked["schema_valid"],
                "quality_ok": checked["ok"],
                "quality_errors": checked["errors"],
            }
        else:
            result = {"schema_valid": False, "quality_ok": False, "quality_errors": ["no_complete_json_memo"]}
        wanted = expected[key]
        matched = status == "completed" and all(
            result[actual] == wanted[declared]
            for actual, declared in [("schema_valid", "expected_schema_valid"), ("quality_ok", "expected_quality_ok")]
        )
        scored.append(
            {
                "case_id": key[0],
                "sample_id": key[1],
                "status": status,
                "schema_valid": result["schema_valid"],
                "quality_ok": result["quality_ok"],
                "expectation_matched": matched,
                "quality_errors": result.get("quality_errors", []),
            }
        )

    def key_rows(keys):
        return [{"case_id": case, "sample_id": sample} for case, sample in sorted(keys)]

    missing, extra = set(expected) - set(seen), set(seen) - set(expected)
    duplicates = [key for key, count in seen.items() if count != 1]
    complete = integrity_ok and not (missing or extra or duplicates or invalid)
    schema = resources.files("agenda_intelligence") / "data/schemas/v1/agenda-memo.schema.json"
    return {
        "contract_version": 1,
        "scorer_revision": revision,
        "scorer_package_version": __version__,
        "capture_provenance": meta.get("provenance"),
        "capture_schema_sha256": meta.get("schema_sha256"),
        "scorer_schema_sha256": _digest(schema.read_bytes()),
        "raw_integrity_ok": integrity_ok,
        "coverage_complete": complete,
        "expected_records": len(expected),
        "observed_records": sum(seen.values()),
        "missing": key_rows(missing),
        "unexpected": key_rows(extra),
        "duplicates": key_rows(duplicates),
        "invalid_lines": invalid,
        "technical_failures": sum(row["status"] != "completed" for row in scored),
        "expectation_match_pct": (
            round(100 * sum(row["expectation_matched"] for row in scored) / len(expected), 1) if complete else None
        ),
        "all_expectations_met": all(row["expectation_matched"] for row in scored) if complete else None,
        "cases": scored,
        "scope": meta.get("scope"),
    }


def _revision() -> str:
    """Fingerprint the installed scorer rather than an unrelated working tree."""
    digest = hashlib.sha256()
    package = resources.files("agenda_intelligence")
    for name in ["memo_replay.py", "product.py", "memo_quality.py", "evidence_mode.py"]:
        digest.update(name.encode("utf-8"))
        digest.update((package / name).read_bytes())
    return f"package:{__version__};scorer_sha256:{digest.hexdigest()}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    record = subparsers.add_parser("capture")
    record.add_argument("--manifest", type=Path, required=True)
    record.add_argument("--run-dir", type=Path, required=True)
    score = subparsers.add_parser("score")
    score.add_argument("--run-dir", type=Path, required=True)
    score.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "capture":
            meta = capture(args.manifest, args.run_dir, revision=_revision())
            print(json.dumps({"captured_records": len(meta["cases"]), "model_invoked": False}))
            return 0
        if args.output.resolve() in {(args.run_dir / name).resolve() for name in ["raw.jsonl", "meta.json"]}:
            raise ValueError("Summary output must not overwrite captured artifacts.")
        result = rescore(args.run_dir, revision=_revision())
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(
            json.dumps(
                {key: result[key] for key in ["coverage_complete", "all_expectations_met", "expectation_match_pct"]}
            )
        )
        return 0 if result["coverage_complete"] and result["all_expectations_met"] else 1
    except (ValueError, OSError) as error:
        print(f"memo replay failed: {type(error).__name__}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
