"""Evidence assembly helpers for response construction.

The ledger is deliberately internal. It records evidence gathered during a
workflow so final assembly can normalize references and keep presentation
formatting from mutating route, score, verdict, or evidence channels.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Sequence


DEFAULT_PRESENTATION_FIELDS = frozenset({"message", "markdown", "rendered_memo", "human_readable"})


@dataclass(frozen=True)
class EvidenceReference:
    """One evidence reference observed during a workflow."""

    evidence_id: str
    source_type: str = "source"
    title: str = ""
    locator: str = ""
    supports_final: bool = True
    protected: bool = False
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def normalized_key(self) -> tuple[str, str]:
        evidence_key = _normalize_token(self.evidence_id)
        locator_key = _normalize_locator(self.locator)
        return (evidence_key, locator_key)


@dataclass(frozen=True)
class ClaimSupport:
    """Claim-to-evidence relationship captured before final assembly."""

    claim_id: str
    evidence_ids: tuple[str, ...]
    support_status: str
    note: str = ""


class EvidenceLedger:
    """Append-only evidence accumulator with deterministic reference normalization."""

    def __init__(self) -> None:
        self._references: list[EvidenceReference] = []
        self._claim_support: list[ClaimSupport] = []
        self._data_integrity_notes: list[dict[str, Any]] = []

    def add_reference(
        self,
        evidence_id: str,
        *,
        source_type: str = "source",
        title: str = "",
        locator: str = "",
        supports_final: bool = True,
        protected: bool = False,
        metadata: Mapping[str, Any] | None = None,
    ) -> None:
        if not evidence_id and not locator:
            raise ValueError("reference requires evidence_id or locator")
        self._references.append(
            EvidenceReference(
                evidence_id=evidence_id,
                source_type=source_type,
                title=title,
                locator=locator,
                supports_final=supports_final,
                protected=protected,
                metadata=dict(metadata or {}),
            )
        )

    def add_claim_support(
        self,
        claim_id: str,
        evidence_ids: Iterable[str],
        *,
        support_status: str,
        note: str = "",
    ) -> None:
        if not claim_id:
            raise ValueError("claim_support requires claim_id")
        self._claim_support.append(
            ClaimSupport(
                claim_id=claim_id,
                evidence_ids=tuple(eid for eid in evidence_ids if eid),
                support_status=support_status,
                note=note,
            )
        )

    def add_data_integrity_note(self, note: str, *, evidence_id: str = "", severity: str = "warning") -> None:
        if not note:
            raise ValueError("data_integrity_note requires note")
        self._data_integrity_notes.append(
            {
                "note": note,
                "evidence_id": evidence_id,
                "severity": severity,
            }
        )

    @property
    def raw_reference_count(self) -> int:
        return len(self._references)

    def normalized_references(
        self,
        *,
        include_protected: bool = False,
        final_only: bool = True,
    ) -> list[dict[str, Any]]:
        """Return de-duplicated, safety-filtered references for final assembly."""

        merged: dict[tuple[str, str], dict[str, Any]] = {}
        order: list[tuple[str, str]] = []

        for ref in self._references:
            if final_only and not ref.supports_final:
                continue
            if ref.protected and not include_protected:
                continue

            key = ref.normalized_key()
            if key not in merged:
                order.append(key)
                merged[key] = {
                    "evidence_id": ref.evidence_id,
                    "source_type": ref.source_type,
                    "title": ref.title,
                    "locator": ref.locator,
                    "metadata": dict(ref.metadata),
                }
                if ref.protected:
                    merged[key]["protected"] = True
                continue

            existing = merged[key]
            if ref.protected:
                existing["protected"] = True
            if not existing.get("source_type") and ref.source_type:
                existing["source_type"] = ref.source_type
            if not existing.get("title") and ref.title:
                existing["title"] = ref.title
            if not existing.get("evidence_id") and ref.evidence_id:
                existing["evidence_id"] = ref.evidence_id
            if not existing.get("locator") and ref.locator:
                existing["locator"] = ref.locator
            existing["metadata"] = {**dict(existing.get("metadata") or {}), **dict(ref.metadata)}

        return [_strip_empty(merged[key]) for key in order]

    def snapshot(self, *, include_protected: bool = False) -> dict[str, Any]:
        """Return structured state suitable for response assembly or debugging."""

        return {
            "references": self.normalized_references(include_protected=include_protected),
            "claim_support": [
                _strip_empty(
                    {
                        "claim_id": item.claim_id,
                        "evidence_ids": list(item.evidence_ids),
                        "support_status": item.support_status,
                        "note": item.note,
                    }
                )
                for item in self._claim_support
            ],
            "data_integrity_notes": [
                _strip_empty(note)
                for note in self._data_integrity_notes
                if include_protected
                or not note.get("evidence_id")
                or _evidence_id_is_public(note.get("evidence_id"), self._references)
            ],
        }


def guard_presentation_update(
    before: Mapping[str, Any],
    after: Mapping[str, Any],
    *,
    presentation_fields: Sequence[str] = tuple(sorted(DEFAULT_PRESENTATION_FIELDS)),
) -> dict[str, Any]:
    """Check that a formatter changed only visible presentation fields."""

    mutable = set(presentation_fields)
    keys = set(before) | set(after)
    changed = sorted(key for key in keys if before.get(key) != after.get(key))
    forbidden = [key for key in changed if key not in mutable]
    return {
        "ok": not forbidden,
        "changed_fields": changed,
        "forbidden_changes": forbidden,
    }


def _normalize_token(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _normalize_locator(value: str) -> str:
    text = str(value or "").strip()
    if "://" in text:
        scheme, rest = text.split("://", 1)
        return f"{scheme.lower()}://{rest.rstrip('/')}"
    return text.rstrip("/")


def _strip_empty(payload: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value not in ("", None, [], {})}


def _evidence_id_is_public(evidence_id: Any, refs: Iterable[EvidenceReference]) -> bool:
    wanted = _normalize_token(str(evidence_id or ""))
    for ref in refs:
        if _normalize_token(ref.evidence_id) == wanted:
            return not ref.protected
    return True
