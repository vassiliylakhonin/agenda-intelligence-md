#!/usr/bin/env python3
"""Run the small, hand-labelled evidence diagnostic set, without a model.

Latency is full service time (including validation/index construction), warmed
per case, in this process. No network, claim of general accuracy or LLM judge.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import statistics
import sys
from pathlib import Path
from time import perf_counter_ns

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from agenda_intelligence import __version__  # noqa: E402
from agenda_intelligence.services import check_evidence_packet  # noqa: E402


def run(cases_path: Path, repeats: int = 25) -> dict:
    if not 1 <= repeats <= 1000:
        raise ValueError("repeats must be between 1 and 1000")
    raw = cases_path.read_bytes()
    suite = json.loads(raw)
    results = []
    counts = {"caught": 0, "missed": 0, "false_positive": 0, "clear": 0}
    for case in suite["cases"]:
        packet = case["packet"]
        check_evidence_packet(packet)  # warm-up, excluded from timing
        times = []
        for _ in range(repeats):
            start = perf_counter_ns()
            checked = check_evidence_packet(packet)
            times.append((perf_counter_ns() - start) / 1_000_000)
        if not checked["valid"]:
            raise ValueError(f"Invalid benchmark fixture {case['id']}: {checked['errors']}")
        response = checked["response"]
        flagged = response["packet_status"] != "packet_complete"
        category = (
            ("caught" if flagged else "missed") if case["expect_flag"] else ("false_positive" if flagged else "clear")
        )
        counts[category] += 1
        results.append(
            {
                "id": case["id"],
                "kind": case["kind"],
                "expect_flag": case["expect_flag"],
                "packet_status": response["packet_status"],
                "category": category,
                "issues": [issue for claim in response["claims"] for issue in claim["issues"]],
                "median_ms": round(statistics.median(times), 3),
                "p95_ms": round(sorted(times)[max(0, (95 * len(times) + 99) // 100 - 1)], 3),
            }
        )
    return {
        "suite_sha256": hashlib.sha256(raw).hexdigest(),
        "package_version": __version__,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "timing": "full local service, one excluded warm-up per case, sequential, no network",
        "repeats_per_case": repeats,
        "counts": counts,
        "results": results,
        "limitations": [
            "Small hand-labelled diagnostic set, not a random sample or production accuracy estimate.",
            "Public-source snapshots and synthetic probes are labelled separately. No unpublished paper text.",
            "Flags indicate review needed, not falsity. Lexical passes are not semantic entailment or truth.",
            "Latency depends on machine, Python version, text length and source count; not a speed guarantee.",
            "No LLM judge, model call or comparison against another product.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=Path(__file__).with_name("cases.json"))
    parser.add_argument("--repeats", type=int, default=25)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    report = run(args.cases, args.repeats)
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
