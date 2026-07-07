"""Static readiness lint for a published agent card (A2A-style JSON).

Checks a card against the delegation-readiness checklist in
``AGENT_READINESS.md`` plus the statically checkable subset of the public
Agenstry conformance methodology v1.0 (CC-BY-4.0,
https://agenstry.com/api/schemas/conformance.json).

Scope: structural lint of declared card fields only. No endpoint probing,
no cryptographic signature verification, no uptime or reputation scoring,
and no factual-truth verification. Not a security audit and not legal,
compliance, or financial advice.
"""

from __future__ import annotations

from typing import Any, Iterator

# Registry preflight criteria that cannot be evaluated without live probes.
LIVE_ONLY_CRITERIA = (
    ("live_jsonrpc", "endpoint must answer message/send; requires a live probe"),
    ("uptime_track", "probe success ratio over trailing window; requires probe history"),
    ("freshness", "last successful probe recency; requires probe history"),
)

# Heuristic markers for an explicit human-oversight or boundary statement.
HUMAN_LOOP_MARKERS = (
    "human review",
    "human-review",
    "human-in-the-loop",
    "human in the loop",
    "human oversight",
    "requires human",
    "escalat",
)
BOUNDARY_MARKERS = (
    "not legal",
    "not compliance",
    "not financial",
    "not investment",
    "not advice",
    "not autonomous",
    "no autonomous",
    "not an autonomous",
    "does not decide",
    "triage only",
    "evidence-readiness only",
)

PAYMENT_KEY_MARKERS = ("payment", "x402", "wallet", "billing", "pricing")
PAYMENT_LIMIT_MARKERS = ("limit", "max", "cap", "permission", "scope", "allowance")

REPORT_NOTE = (
    "Static lint of declared agent-card fields only. Does not probe endpoints, "
    "verify JWS signatures cryptographically, check uptime, score reputation, "
    "or verify factual truth. Not a security audit and not legal, compliance, "
    "or financial advice."
)


def _nonempty_str(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _walk(obj: Any, path: str = "") -> Iterator[tuple[str, str, Any]]:
    """Yield (dotted_path, key, value) for every dict key in a nested structure."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            child = f"{path}.{key}" if path else str(key)
            yield child, str(key), value
            yield from _walk(value, child)
    elif isinstance(obj, list):
        for index, item in enumerate(obj):
            yield from _walk(item, f"{path}[{index}]")


def _card_text(card: dict) -> str:
    parts = [card.get("description") or ""]
    for skill in card.get("skills") or []:
        if isinstance(skill, dict):
            parts.append(skill.get("description") or "")
    return " ".join(parts).lower()


def _subtree_keys(value: Any) -> list[str]:
    return [key.lower() for _, key, _ in _walk(value)]


# ---------------------------------------------------------------------------
# Registry conformance preflight (static subset)
# ---------------------------------------------------------------------------


def _preflight_checks(card: dict) -> list[dict]:
    checks: list[dict] = []

    required_fields = ["protocolVersion", "name", "description", "url", "provider", "version", "skills"]
    missing = [field for field in required_fields if not card.get(field)]
    checks.append(
        {
            "id": "valid_card_shape",
            "status": "pass" if not missing else "gap",
            "detail": (
                "required card fields present (structural check, not official A2A schema validation)"
                if not missing
                else f"missing required card fields: {', '.join(missing)}"
            ),
        }
    )

    protocol_version = card.get("protocolVersion")
    checks.append(
        {
            "id": "protocol_version_string",
            "status": "pass" if protocol_version == "1.0" else "gap",
            "detail": (
                'protocolVersion declared as string "1.0"'
                if protocol_version == "1.0"
                else f'protocolVersion should be the string "1.0"; found {protocol_version!r}'
            ),
        }
    )

    signatures = card.get("signatures")
    signed_array = isinstance(signatures, list) and any(
        isinstance(sig, dict) and _nonempty_str(sig.get("protected")) and _nonempty_str(sig.get("signature"))
        for sig in signatures
    )
    compact = card.get("signature")
    compact_parts = compact.split(".") if isinstance(compact, str) else []
    signed_compact = len(compact_parts) == 3 and bool(compact_parts[0]) and bool(compact_parts[2])
    if signed_array or signed_compact:
        jws_shape = "signatures[] entry" if signed_array else "compact (detached) JWS string in signature"
        jws_detail = f"JWS present as {jws_shape} (presence/shape only; not cryptographically verified here)"
    else:
        jws_detail = (
            "no JWS found (neither signatures[] entries nor a compact signature string); "
            "registries score signed cards separately"
        )
    checks.append(
        {
            "id": "jws_signature_present",
            "status": "pass" if signed_array or signed_compact else "gap",
            "detail": jws_detail,
        }
    )

    skills = card.get("skills") or []
    skills_ok = bool(skills) and all(
        isinstance(skill, dict) and _nonempty_str(skill.get("id")) and _nonempty_str(skill.get("name"))
        for skill in skills
    )
    checks.append(
        {
            "id": "skills_declared",
            "status": "pass" if skills_ok else "gap",
            "detail": (
                f"{len(skills)} skill(s) declared with id + name"
                if skills_ok
                else "skills[] must be non-empty and every skill needs id + name"
            ),
        }
    )

    provider = card.get("provider") or {}
    provider_name = provider.get("organization") or provider.get("name")
    provider_ok = isinstance(provider, dict) and _nonempty_str(provider_name) and _nonempty_str(provider.get("url"))
    checks.append(
        {
            "id": "provider_attribution",
            "status": "pass" if provider_ok else "gap",
            "detail": (
                "provider organization + url declared"
                if provider_ok
                else "provider must declare organization (or name) and url"
            ),
        }
    )

    legal_entity = provider.get("legalEntity") if isinstance(provider, dict) else None
    identity_keys = [key for _, key, _ in _walk(provider)] if isinstance(provider, dict) else []
    has_identity = isinstance(legal_entity, dict) or any(key.lower() in {"lei", "leicode"} for key in identity_keys)
    checks.append(
        {
            "id": "business_identity_declared",
            "status": "pass" if has_identity else "gap",
            "detail": (
                "provider declares a legalEntity/registry identifier "
                "(declaration only; registry matching is a live-side check)"
                if has_identity
                else "no legalEntity or registry identifier (LEI etc.) declared on provider"
            ),
        }
    )

    for criterion_id, reason in LIVE_ONLY_CRITERIA:
        checks.append({"id": criterion_id, "status": "skipped", "detail": f"out of scope for static lint: {reason}"})

    return checks


# ---------------------------------------------------------------------------
# Delegation-readiness checklist
# ---------------------------------------------------------------------------


def _readiness_checks(card: dict) -> list[dict]:
    checks: list[dict] = []
    provider = card.get("provider") or {}

    missing = []
    provider_name = provider.get("organization") or provider.get("name") if isinstance(provider, dict) else None
    if not _nonempty_str(provider_name):
        missing.append("provider.organization")
    if not (isinstance(provider, dict) and _nonempty_str(provider.get("url"))):
        missing.append("provider.url")
    if not _nonempty_str(card.get("version")):
        missing.append("version")
    if not _nonempty_str(card.get("documentationUrl")):
        missing.append("documentationUrl")
    checks.append(
        {
            "id": "identity_attribution",
            "status": "covered" if not missing else "gap",
            "detail": (
                "operator, version, and documentation are declared"
                if not missing
                else f"missing declarations: {', '.join(missing)}"
            ),
        }
    )

    skills = [skill for skill in (card.get("skills") or []) if isinstance(skill, dict)]
    described = bool(skills) and all(_nonempty_str(skill.get("description")) and skill.get("tags") for skill in skills)
    has_default_modes = bool(card.get("defaultInputModes")) and bool(card.get("defaultOutputModes"))
    has_per_skill_modes = bool(skills) and all(skill.get("inputModes") and skill.get("outputModes") for skill in skills)
    scope_ok = described and (has_default_modes or has_per_skill_modes)
    checks.append(
        {
            "id": "capability_scope",
            "status": "covered" if scope_ok else "gap",
            "detail": (
                "every skill carries description + tags, and input/output modes are declared"
                if scope_ok
                else "each skill needs description + tags, plus default or per-skill input/output modes"
            ),
        }
    )

    interfaces = card.get("supportedInterfaces") or []
    interfaces_ok = bool(interfaces) and all(
        isinstance(entry, dict)
        and _nonempty_str(entry.get("url"))
        and _nonempty_str(entry.get("protocolBinding"))
        and _nonempty_str(entry.get("protocolVersion"))
        for entry in interfaces
    )
    legacy_ok = _nonempty_str(card.get("url")) and bool(card.get("protocolVersions"))
    if interfaces_ok:
        interface_status, interface_detail = "covered", "supportedInterfaces[] declares url + binding + version"
    elif legacy_ok:
        interface_status = "covered"
        interface_detail = "legacy shape: top-level url + protocolVersions (prefer supportedInterfaces[])"
    else:
        interface_status = "gap"
        interface_detail = "declare supportedInterfaces[] (url, protocolBinding, protocolVersion)"
    checks.append({"id": "interface_contract", "status": interface_status, "detail": interface_detail})

    schemes = card.get("securitySchemes")
    if isinstance(schemes, dict) and schemes:
        described_schemes = all(
            any(key == "description" and _nonempty_str(value) for _, key, value in _walk(scheme))
            for scheme in schemes.values()
        )
        referenced: set[str] = set()
        for entry in card.get("security") or []:
            if isinstance(entry, dict):
                referenced.update(entry.keys())
        for entry in card.get("securityRequirements") or []:
            if isinstance(entry, dict):
                referenced.update(entry.get("schemes") or [])
        unknown = sorted(referenced - set(schemes.keys()))
        if described_schemes and not unknown:
            security_status = "covered"
            security_detail = "securitySchemes declared with descriptions; referenced schemes resolve"
        elif unknown:
            security_status = "gap"
            security_detail = f"security references undeclared scheme(s): {', '.join(unknown)}"
        else:
            security_status = "gap"
            security_detail = "every securityScheme needs a description callers can act on"
    else:
        security_status = "gap"
        security_detail = (
            "no securitySchemes declared; state the auth posture explicitly, even for an open demo endpoint"
        )
    checks.append({"id": "security_declaration", "status": security_status, "detail": security_detail})

    text = _card_text(card)
    matched = [marker for marker in HUMAN_LOOP_MARKERS + BOUNDARY_MARKERS if marker in text]
    checks.append(
        {
            "id": "autonomy_boundary",
            "status": "covered" if matched else "gap",
            "detail": (
                f"boundary/human-oversight statement found (heuristic markers: {', '.join(sorted(set(matched))[:4])})"
                if matched
                else "no explicit autonomy boundary or human-escalation statement found in card text (heuristic)"
            ),
        }
    )

    payment_nodes = [
        (path, value)
        for path, key, value in _walk(card)
        if any(marker in key.lower() for marker in PAYMENT_KEY_MARKERS)
    ]
    if not payment_nodes:
        checks.append(
            {
                "id": "payment_permissions",
                "status": "not_applicable",
                "detail": "payment-free: no payment surface declared on this card",
            }
        )
    else:
        limited = any(
            any(any(marker in key for marker in PAYMENT_LIMIT_MARKERS) for key in _subtree_keys(value))
            for _, value in payment_nodes
        )
        paths = ", ".join(path for path, _ in payment_nodes[:3])
        checks.append(
            {
                "id": "payment_permissions",
                "status": "covered" if limited else "gap",
                "detail": (
                    f"payment surface ({paths}) declares limits/permissions"
                    if limited
                    else f"payment surface declared ({paths}) without limits, caps, or permission scope"
                ),
            }
        )

    contact_ok = (
        isinstance(provider, dict)
        and _nonempty_str(provider.get("url"))
        and _nonempty_str(card.get("documentationUrl"))
    )
    checks.append(
        {
            "id": "operator_contact",
            "status": "covered" if contact_ok else "gap",
            "detail": (
                "provider.url + documentationUrl give callers an operator surface"
                if contact_ok
                else "declare both provider.url and documentationUrl so callers can reach the operator"
            ),
        }
    )

    return checks


def evaluate_agent_card(card: dict) -> dict:
    """Return a structured readiness report for an agent-card dict."""
    preflight = _preflight_checks(card)
    readiness = _readiness_checks(card)
    preflight_counts = {
        status: sum(1 for c in preflight if c["status"] == status) for status in ("pass", "gap", "skipped")
    }
    readiness_counts = {
        status: sum(1 for c in readiness if c["status"] == status) for status in ("covered", "gap", "not_applicable")
    }
    return {
        "card_name": card.get("name") if _nonempty_str(card.get("name")) else None,
        "preflight": preflight,
        "readiness": readiness,
        "summary": {
            "preflight": preflight_counts,
            "readiness": readiness_counts,
            "strict_ok": preflight_counts["gap"] == 0 and readiness_counts["gap"] == 0,
        },
        "note": REPORT_NOTE,
    }


def format_report_text(report: dict) -> str:
    lines = [f"agent card readiness: {report['card_name'] or '<unnamed>'}"]
    lines.append("  registry conformance preflight (static subset):")
    for check in report["preflight"]:
        lines.append(f"    - {check['id']}: {check['status']} ({check['detail']})")
    lines.append("  delegation readiness:")
    for check in report["readiness"]:
        lines.append(f"    - {check['id']}: {check['status']} ({check['detail']})")
    preflight = report["summary"]["preflight"]
    readiness = report["summary"]["readiness"]
    lines.append(
        "summary: preflight "
        f"{preflight['pass']} pass / {preflight['gap']} gap / {preflight['skipped']} skipped; "
        f"readiness {readiness['covered']} covered / {readiness['gap']} gap / "
        f"{readiness['not_applicable']} not applicable"
    )
    lines.append(f"note: {report['note']}")
    return "\n".join(lines)
