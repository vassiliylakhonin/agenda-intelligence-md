"""Reference integrity, not document authenticity or evidence-content review."""

import re
from collections import defaultdict
from datetime import date


def review_source_records(sources: list, *, date_required: bool = True) -> dict:
    ids: dict[str, set[str]] = defaultdict(set)
    for source in sources:
        if isinstance(source, dict):
            ids[str(source.get("id", "")).strip()].add(str(source.get("source_type", "")))
    usable = []
    issues = []
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            continue
        source_type = source.get("source_type", "")
        reasons = []
        if not str(source.get("id", "")).strip() or not str(source.get("title", "")).strip():
            reasons.append("Supply a nonblank source ID and title.")
        if len(ids[str(source.get("id", "")).strip()]) > 1:
            reasons.append("Source ID has conflicting document types; assign distinct records or resolve the conflict.")
        raw_date = source.get("date")
        if date_required or raw_date is not None:
            try:
                if not isinstance(raw_date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
                    raise ValueError("invalid date")
                date.fromisoformat(raw_date)
            except ValueError:
                reasons.append("Supply a real calendar date in YYYY-MM-DD format.")
        for issue in reasons:
            issues.append({"source_index": index, "source_type": source_type, "issue": issue})
        if not reasons and source_type and source_type not in usable:
            usable.append(source_type)
    return {
        "policy_version": "source-records.v1",
        "scope": "reference_metadata_only",
        "source_content_verified": False,
        "freshness_verified": False,
        "usable_source_types": usable,
        "issues": issues,
        "next_action": (
            "Verify source content, issuer, recency and relevance before relying on this reference coverage."
        ),
    }
