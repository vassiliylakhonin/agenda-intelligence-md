#!/usr/bin/env python3
import re
import sys
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples" / "before-after"
SRC = ROOT / "src"
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
if str(SCRIPT_DIR) in sys.path:
    sys.path.remove(str(SCRIPT_DIR))

from agenda_intelligence.eval import score_before_after  # noqa: E402


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


def main() -> None:
    failures = []
    files = sorted(p for p in EXAMPLES.glob("*.md") if p.name not in {"README.md", "evaluation-rubric.md"})
    if not files:
        raise SystemExit("No before/after examples found")

    for p in files:
        text = p.read_text()
        before = section(text, "Before: generic agent output", "What is wrong with the before version")
        after = section(text, "After: with Agenda-Intelligence.md", "Why the after is better")
        result = score_before_after(before, after)
        before_score = result["before_score"]
        after_score = result["after_score"]
        delta = result["delta"]
        after_detail = result["dimensions"]["after"]
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
