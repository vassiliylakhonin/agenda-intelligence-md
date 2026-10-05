"""Deterministic mineral dossier review; supplied records are never authenticated here."""

import re
from datetime import date

STAGE_TIERS = {
    "pre_offtake_agreement": "required_before_offtake",
    "pre_investment_decision": "required_before_investment",
    "pre_export_shipment": "required_before_shipment",
    "pre_exploration": "required_before_exploration",
    "pre_processing_contract": "required_before_processing",
}
SCOPE_FIELDS = ("project_name", "commodity", "origin_jurisdiction")


def _date(value):
    try:
        return (
            date.fromisoformat(value)
            if isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value)
            else None
        )
    except ValueError:
        return None


def review_mineral_dossier(request: dict, taxonomy: dict) -> dict:
    """Review metadata/excerpt availability and declared scope, not the truth of a document."""
    assessment = _date(request.get("assessment_date"))
    rows = [
        (f"{field}[{i}]", source)
        for field in ("supplied_sources", "dated_sources")
        for i, source in enumerate(request.get(field) or [])
    ]
    reviews, eligible, seen = [], [], set()
    for source_ref, source in rows:
        source_type = source.get("source_type", "")
        normalized = (
            "responsible_sourcing_due_diligence" if source_type == "csddd_human_rights_and_esg_audit" else source_type
        )
        issues = []
        for field in ("title", "issuing_authority"):
            if not str(source.get(field) or "").strip():
                issues.append(f"Missing {field}")
        issued = _date(source.get("date"))
        if not issued:
            issues.append("Missing or invalid issue date (YYYY-MM-DD)")
        if assessment and issued and issued > assessment:
            issues.append("Issue date is after assessment_date")
        expiry = _date(source.get("valid_until"))
        if source.get("valid_until") and not expiry:
            issues.append("Invalid valid_until date")
        if expiry and issued and expiry < issued:
            issues.append("Expiry precedes issue date")
        if assessment and expiry and expiry < assessment:
            issues.append("Document expired before assessment_date")
        if not str(source.get("excerpt") or "").strip():
            issues.append("No source excerpt; summary or URL alone is not documentary evidence")
        scope = source.get("scope") or {}
        for field in SCOPE_FIELDS:
            value = str(scope.get(field) or "").strip()
            if not value:
                issues.append(f"Missing scope.{field}")
            elif value.lower() != str(request.get(field) or "").strip().lower():
                issues.append(f"Scope mismatch: {field}")
        identities = [
            f"{k}:{str(source[k]).strip()}" for k in ("document_id", "url") if str(source.get(k) or "").strip()
        ]
        identities.append(
            "metadata:"
            + "|".join(str(source.get(k) or "").strip().lower() for k in ("title", "issuing_authority", "date"))
        )
        identities = [identity for identity in identities if identity and identity != "metadata:||"]
        if any(identity in seen for identity in identities):
            issues.append("Duplicate document reference; cannot fill another requirement")
        seen.update(identities)
        if not issues and normalized not in eligible:
            eligible.append(normalized)
        reviews.append(
            {
                "source_ref": source_ref,
                "source_type": source_type,
                "status": "needs_evidence" if issues else "eligible_for_review",
                "issues": issues,
            }
        )
    required = taxonomy[STAGE_TIERS[request["decision_stage"]]]
    missing = [item for item in required if item not in eligible]
    questions = [
        "Confirm commodity form/grade, end use, shipment date, customs code and transit "
        "jurisdictions before assessing restrictions.",
        "Ask counsel to establish applicable permits and sanctions rules; a commodity or country "
        "label does not establish a prohibition.",
    ]
    if request.get("target_market") == "eu":
        questions.append(
            "Determine CSDDD scope, dates and company thresholds; a responsible-sourcing audit is not "
            "CSDDD certification."
        )
    if request.get("target_market") == "us":
        questions.append(
            "Identify the precise US incentive and acquisition date; Section 30D credits ended for "
            "vehicles acquired after 2025-09-30. Do not infer FEOC clearance from geography."
        )
    if request["commodity"] == "uranium":
        questions.append(
            "Establish natural/enriched material, enrichment origin and destination. US Russian-LEU "
            "restrictions and EU ESA contract procedures have distinct scopes; port transit alone "
            "establishes neither."
        )
    if request["commodity"] == "titanium":
        questions.append(
            "Obtain buyer-specific material grade and qualification records if aerospace use is "
            "intended; ore assay is not finished-product qualification."
        )
    actions = []
    for source_type in missing:
        owner = (
            "compliance counsel"
            if any(term in source_type for term in ("regulatory", "export", "sanctions"))
            else "supplier / dossier owner"
        )
        actions.append(
            {
                "source_type": source_type,
                "owner": owner,
                "priority": "before_decision",
                "action": (
                    f"Supply {source_type.replace('_', ' ')} with issuer, issue date, excerpt and matching "
                    "project/commodity/origin scope; confirm authenticity and applicability with a human reviewer."
                ),
            }
        )
    for blocker in request.get("blockers", []):
        if blocker.strip():
            actions.append(
                {
                    "source_type": "caller_blocker",
                    "owner": "dossier owner / human reviewer",
                    "priority": "before_decision",
                    "action": f"Resolve caller-declared blocker: {blocker.strip()}",
                }
            )
    limitations = [
        "Eligible means dated, scoped excerpt supplied by caller; authenticity, factual support and "
        "legal sufficiency are not verified.",
        "Score measures documentary coverage, not investment quality or probability of compliance.",
        "No automatic transaction approval; a complete dossier still requires human sign-off.",
    ]
    if not assessment:
        limitations.append(
            "No valid assessment_date supplied: freshness and expiry relative to the decision date were not checked."
        )
    return {
        "policy_version": "mineral-dossier.v2",
        "assessment_date": assessment.isoformat() if assessment else None,
        "eligible_source_types": eligible,
        "source_reviews": reviews,
        "owner_actions": actions,
        "applicability_questions": questions,
        "limitations": limitations,
    }
