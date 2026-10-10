"""Smoke the installed RAG adapter with python -I; never add checkout paths.

Only fictional, self-contained evidence is used. No model or network calls.
This tests the distribution, not human usefulness or adoption.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import agenda_intelligence
from agenda_intelligence import RagReviewError, review_rag_answer


def main() -> None:
    package_path = Path(agenda_intelligence.__file__).resolve()
    if "site-packages" not in package_path.parts:
        raise SystemExit("Expected an installed distribution, not a source checkout")
    source = {"source_id": "pilot-1", "text": "The pilot processed 120 invoices."}
    answer = "The pilot processed 900 invoices. [pilot-1]"
    original = review_rag_answer(answer, [source])
    assert original["route"] == "revise"
    assert "900" in original["verification"]["claims"][0]["lexical_support"]["unmatched_numbers"]
    repaired_answer = answer.replace("900", "120")
    revised = review_rag_answer(repaired_answer, [source])
    assert revised["route"] == "human_review"
    assert revised["verification"]["factuality_status"] == "not_assessed"
    assert revised["human_review_required"] is True
    assert original["input_sha256"] != revised["input_sha256"]
    try:
        review_rag_answer("", [source])
    except RagReviewError:
        pass
    else:
        raise AssertionError("Empty answer must not become a successful review")
    with tempfile.TemporaryDirectory(prefix="agenda-rag-smoke-") as directory:
        request_path = Path(directory) / "answer.json"
        for text, route, exit_code in [(answer, "revise", 1), (repaired_answer, "human_review", 0)]:
            request_path.write_text(json.dumps({"answer": text, "sources": [source]}), encoding="utf-8")
            checked = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-m",
                    "agenda_intelligence.cli",
                    "review-answer",
                    str(request_path),
                    "--strict",
                    "--format",
                    "json",
                ],
                cwd=directory,
                capture_output=True,
                text=True,
                check=False,
            )
            assert checked.returncode == exit_code, checked.stderr
            assert json.loads(checked.stdout)["route"] == route
    print(
        json.dumps(
            {
                "package_version": agenda_intelligence.__version__,
                "installed_distribution": True,
                "python_api_repair_recheck": "passed",
                "empty_answer_refusal": "passed",
                "strict_cli_original_exit": 1,
                "strict_cli_revised_exit": 0,
                "fixture_only": True,
                "human_review_completed": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
