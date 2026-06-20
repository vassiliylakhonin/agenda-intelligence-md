"""Post-hoc evidence-mode discipline check for analyze memos.

This module enforces a discipline layer on top of structural memo
validation (which only checks ``agenda-memo.schema.json``). The
schema already permits ``evidence_mode`` of ``reasoning_only``,
``user_provided``, or ``mixed`` and tolerates ``audit.provenance[]``
entries with or without a ``source`` field. The schema description
notes that ``source`` is "absent in reasoning_only mode" — this
module makes that contract enforceable.

Rules
-----
* ``reasoning_only``: no ``audit.provenance[]`` entry may carry a
  ``source`` field. A reasoning-only memo claims no caller-supplied
  evidence; carrying a source string contradicts the declared mode.
* ``user_provided`` or ``mixed``: every provenance entry whose
  ``basis`` is ``"fact"`` must either carry a non-empty ``source``
  string or end its ``claim`` text with the literal token
  ``[verify]`` (case-sensitive), allowing only trailing punctuation
  or whitespace after the token. These modes must also carry at
  least one provenance entry; a source-backed mode with no provenance
  contradicts the declaration. Assessments, assumptions, and unknowns
  are exempt from the per-fact source rule because they are not
  asserted as factual.

Not a schema replacement. Not an MCP tool. Not a CLI subcommand yet.
Importable Python function used by tests and (later) by the bench
and rubric pipelines.
"""

from __future__ import annotations

import re
from typing import Any

VERIFY_MARKER = "[verify]"
VERIFY_MARKER_AT_END = re.compile(r"\[verify\][\s\.,;:!?\)\]\}\"']*$")


def _has_verify_marker_at_end(claim: Any) -> bool:
    return isinstance(claim, str) and bool(VERIFY_MARKER_AT_END.search(claim))


def check_evidence_mode_discipline(memo: dict[str, Any]) -> dict[str, Any]:
    """Return ``{"ok": bool, "errors": list[str]}``.

    ``memo`` is expected to already pass ``validate_memo`` against
    ``agenda-memo.schema.json``. This function does not re-check
    schema shape; it only enforces the evidence-mode discipline
    rules documented in the module docstring.
    """
    errors: list[str] = []

    meta = memo.get("meta") or {}
    mode = meta.get("evidence_mode")
    if mode not in {"reasoning_only", "user_provided", "mixed"}:
        return {
            "ok": False,
            "errors": [f"meta.evidence_mode missing or unknown: {mode!r}"],
        }

    audit = memo.get("audit") or {}
    provenance = audit.get("provenance") or []

    if mode == "reasoning_only":
        for idx, entry in enumerate(provenance):
            if "source" in entry and entry["source"]:
                errors.append(
                    f"audit.provenance[{idx}] carries source={entry['source']!r} "
                    f"but evidence_mode is reasoning_only"
                )
    else:
        if not provenance:
            errors.append(f"audit.provenance must contain at least one entry when evidence_mode={mode}")
        for idx, entry in enumerate(provenance):
            if entry.get("basis") != "fact":
                continue
            has_source = bool(entry.get("source"))
            claim = entry.get("claim", "")
            has_verify = _has_verify_marker_at_end(claim)
            if not (has_source or has_verify):
                errors.append(
                    f"audit.provenance[{idx}] basis=fact has no source and no "
                    f"{VERIFY_MARKER} marker (evidence_mode={mode})"
                )

    return {"ok": not errors, "errors": errors}
