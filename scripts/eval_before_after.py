#!/usr/bin/env python3
from pathlib import Path
from typing import Optional
import re

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples" / "before-after"

CRITERIA = {
    "signal_classification": [
        "signal classification",
        "weak signal",
        "trigger event",
        "compliance-relevant",
        "escalation marker",
    ],
    "what_changed": ["what changed", "moved from", "shift", "delta", "changed"],
    "actor_specificity": [
        "who is affected",
        "providers",
        "deployers",
        "banks",
        "logistics",
        "insurers",
        "exporters",
        "firms",
    ],
    "mechanism": ["mechanism", "through", "via", "because", "depends on", "channel", "exposure"],
    "uncertainty": ["main uncertainty", "uncertainty", "whether"],
    "falsifiability": ["confirm", "falsify", "weaken", "upgrade", "downgrade", "until supported"],
    "watch_next": ["watch next", "watch for", "indicators", "guidance", "deadline", "enforcement"],
    "decision_value": ["treat this as", "base case", "higher-risk", "contained", "operational", "compliance impact"],
}


def section(text: str, start: str, end: Optional[str] = None) -> str:
    pattern = (
        rf"## {re.escape(start)}[^\n]*\n\n(.*?)(?=\n## {re.escape(end)}[^\n]*\n\n|\Z)"
        if end
        else rf"## {re.escape(start)}[^\n]*\n\n(.*)"
    )
    m = re.search(pattern, text, flags=re.S)
    if not m:
        raise AssertionError(f"Missing section: {start}")
    return m.group(1).strip().lower()


def score(text: str) -> tuple[int, dict[str, int]]:
    scores = {}
    for name, tokens in CRITERIA.items():
        hits = sum(1 for t in tokens if t in text)
        scores[name] = min(2, hits)
    return sum(scores.values()), scores


def main() -> None:
    failures = []
    files = sorted(p for p in EXAMPLES.glob("*.md") if p.name not in {"README.md", "evaluation-rubric.md"})
    if not files:
        raise SystemExit("No before/after examples found")

    for p in files:
        text = p.read_text()
        before = section(text, "Before: generic agent output", "What is wrong with the before version")
        after = section(text, "After: with Agenda-Intelligence.md", "Why the after is better")
        before_score, before_detail = score(before)
        after_score, after_detail = score(after)
        delta = after_score - before_score
        print(f"{p.name}: before={before_score}/16 after={after_score}/16 delta=+{delta}")
        if after_score < 11:
            failures.append(f"{p.name}: after score below decision-useful threshold: {after_score}")
        if delta < 6:
            failures.append(f"{p.name}: improvement delta too small: {delta}")
        if (
            after_detail["watch_next"] < 1
            or after_detail["uncertainty"] < 1
            or after_detail["signal_classification"] < 1
        ):
            failures.append(f"{p.name}: after missing core signal/uncertainty/watch-next criteria")

    if failures:
        raise SystemExit("\n".join(failures))
    print("OK: before/after examples improve rubric scores")


if __name__ == "__main__":
    main()
