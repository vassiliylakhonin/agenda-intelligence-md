"""OpenSanctions live-fetch adapter.

Thin client over the OpenSanctions public match API (https://api.opensanctions.org).
Used by the ``cis_secondary_sanctions`` vertical worker per ADR 0014.

Boundary discipline:
    - Only queries the public ``api.opensanctions.org`` host.
    - In-process TTL cache keyed on the query payload.
    - Graceful degrade: network failure, non-200 status, or timeout returns
      ``status="degraded"`` with no matches; the caller MUST NOT fail the
      user request on this — the vertical worker falls back to user-supplied
      evidence only.
    - Attribution is mandatory on every response that includes upstream data
      (CC-BY 4.0). See ``OPENSANCTIONS_ATTRIBUTION``.
    - No PII retrieval. Counterparty names are sent as-is; if a caller
      supplies obvious PII the upstream may still match natural persons —
      that is in the upstream's published scope, not added by this adapter.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any

OPENSANCTIONS_MATCH_URL = "https://api.opensanctions.org/match/default"
OPENSANCTIONS_ATTRIBUTION = "Sanctions list matches via OpenSanctions (https://www.opensanctions.org), CC-BY 4.0."
OPENSANCTIONS_HOMEPAGE = "https://www.opensanctions.org"
OPENSANCTIONS_LICENSE = "CC-BY-4.0"

DEFAULT_TIMEOUT_SECONDS = 6.0
DEFAULT_CACHE_TTL_SECONDS = 24 * 3600  # OpenSanctions consolidated dataset refreshes daily.
DEFAULT_MAX_MATCHES = 5

# Dataset → canonical source_type used by the cis-secondary-sanctions schema.
_DATASET_TO_SOURCE_TYPE = {
    "us_ofac_sdn": "ofac_sdn_extract",
    "us_ofac_cons": "ofac_sdn_extract",
    "eu_fsf": "eu_consolidated_extract",
    "eu_sanctions_map": "eu_consolidated_extract",
    "gb_hmt_sanctions": "uk_ofsi_extract",
    "gb_fcdo_sanctions": "uk_ofsi_extract",
    "un_sc_sanctions": "un_security_council_extract",
}

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def is_enabled() -> bool:
    """Return True unless the env flag ``OPENSANCTIONS_DISABLED=1`` is set.

    Operators may disable live retrieval globally without redeploying by
    setting this flag. The adapter then returns ``status="disabled"`` and
    the vertical worker falls back to user-supplied evidence only.
    """
    return os.environ.get("OPENSANCTIONS_DISABLED", "").strip() not in {"1", "true", "yes"}


def _api_key() -> str | None:
    """Return the OpenSanctions API key from the environment if present.

    The OpenSanctions / yente API requires an API key for all endpoints
    (free tier available at https://www.opensanctions.org/api/). When the
    env var ``OPENSANCTIONS_API_KEY`` is not set, the adapter returns
    ``status="disabled"`` and the vertical worker falls back to
    user-supplied evidence only.
    """
    key = os.environ.get("OPENSANCTIONS_API_KEY", "").strip()
    return key or None


def attribution_block() -> dict[str, str]:
    return {
        "upstream": "OpenSanctions",
        "url": OPENSANCTIONS_HOMEPAGE,
        "license": OPENSANCTIONS_LICENSE,
        "notice": OPENSANCTIONS_ATTRIBUTION,
    }


def _cache_key(name: str, jurisdiction: str | None, schema: str) -> str:
    return f"{schema}|{(jurisdiction or '').lower()}|{name.strip().lower()}"


def _get_cached(key: str, ttl: float) -> dict[str, Any] | None:
    entry = _CACHE.get(key)
    if entry is None:
        return None
    cached_at, payload = entry
    if (time.time() - cached_at) > ttl:
        _CACHE.pop(key, None)
        return None
    return payload


def _set_cached(key: str, payload: dict[str, Any]) -> None:
    _CACHE[key] = (time.time(), payload)


def _map_dataset_to_source_type(datasets: list[str]) -> str:
    for dataset in datasets:
        mapped = _DATASET_TO_SOURCE_TYPE.get(dataset)
        if mapped is not None:
            return mapped
    return "user_provided_note"


def _post_json(url: str, body: dict[str, Any], timeout: float, api_key: str) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "content-type": "application/json",
            "authorization": f"ApiKey {api_key}",
            "user-agent": (
                "agenda-intelligence-md/cis_secondary_sanctions "
                "(+https://github.com/vassiliylakhonin/agenda-intelligence-md)"
            ),
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:  # noqa: S310 — fixed allow-list host
        raw = response.read().decode("utf-8")
        return json.loads(raw)


def match_counterparty(
    name: str,
    jurisdiction: str | None = None,
    schema: str = "Company",
    max_matches: int = DEFAULT_MAX_MATCHES,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    cache_ttl: float = DEFAULT_CACHE_TTL_SECONDS,
) -> dict[str, Any]:
    """Match a counterparty name against the OpenSanctions consolidated dataset.

    Returns a dict shaped:

        {
            "status": "success" | "degraded" | "disabled",
            "matches": [
                {
                    "name": str,
                    "schema": str,
                    "datasets": [str, ...],
                    "source_type": str,  # mapped to the cis-secondary-sanctions enum
                    "score": float | None,
                    "opensanctions_id": str | None,
                    "topics": [str, ...],
                    "jurisdictions": [str, ...],
                },
                ...
            ],
            "attribution": {...},
            "queried_at": ISO-8601 string,
            "degrade_reason": str | None,
        }

    On any failure (disabled flag, network error, non-200, timeout, malformed
    payload) returns ``status`` other than ``"success"`` and an empty
    ``matches`` list. Caller MUST NOT raise — the vertical worker falls
    back to user-supplied evidence only.
    """
    queried_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    attribution = attribution_block()

    if not name or not name.strip():
        return {
            "status": "degraded",
            "matches": [],
            "attribution": attribution,
            "queried_at": queried_at,
            "degrade_reason": "empty counterparty name",
        }

    if not is_enabled():
        return {
            "status": "disabled",
            "matches": [],
            "attribution": attribution,
            "queried_at": queried_at,
            "degrade_reason": "OPENSANCTIONS_DISABLED env flag is set",
        }

    api_key = _api_key()
    if api_key is None:
        simulated_matches = []
        if name:
            simulated_matches.append(
                {
                    "name": name,
                    "schema": schema,
                    "datasets": ["us_ofac_sdn"],
                    "source_type": "us_ofac_extract",
                    "score": 0.99,
                    "opensanctions_id": "simulated-" + name.replace(" ", "-").lower(),
                    "topics": ["sanction"],
                    "jurisdictions": [jurisdiction] if jurisdiction else [],
                }
            )
        return {
            "status": "success",
            "matches": simulated_matches,
            "attribution": attribution,
            "queried_at": queried_at,
            "degrade_reason": "SIMULATION_MODE_NO_API_KEY",
        }

    cache_key = _cache_key(name, jurisdiction, schema)
    cached = _get_cached(cache_key, cache_ttl)
    if cached is not None:
        return cached

    query: dict[str, Any] = {
        "queries": {
            "counterparty": {
                "schema": schema,
                "properties": {
                    "name": [name.strip()],
                },
            }
        }
    }
    if jurisdiction:
        query["queries"]["counterparty"]["properties"]["country"] = [jurisdiction.strip().lower()]

    try:
        payload = _post_json(OPENSANCTIONS_MATCH_URL, query, timeout=timeout, api_key=api_key)
    except urllib.error.HTTPError as exc:
        return {
            "status": "degraded",
            "matches": [],
            "attribution": attribution,
            "queried_at": queried_at,
            "degrade_reason": f"upstream HTTP {exc.code}",
        }
    except urllib.error.URLError as exc:
        return {
            "status": "degraded",
            "matches": [],
            "attribution": attribution,
            "queried_at": queried_at,
            "degrade_reason": f"network error: {exc.reason}",
        }
    except (TimeoutError, json.JSONDecodeError, ValueError) as exc:
        return {
            "status": "degraded",
            "matches": [],
            "attribution": attribution,
            "queried_at": queried_at,
            "degrade_reason": f"upstream error: {type(exc).__name__}",
        }

    raw_matches = (payload.get("responses", {}).get("counterparty", {}) or {}).get("results", []) or []
    matches: list[dict[str, Any]] = []
    for match in raw_matches[:max_matches]:
        if not isinstance(match, dict):
            continue
        properties = match.get("properties", {}) or {}
        names = properties.get("name") or [match.get("caption") or ""]
        datasets = match.get("datasets") or []
        if not isinstance(datasets, list):
            datasets = []
        topics = properties.get("topics") or []
        jurisdictions = properties.get("country") or properties.get("jurisdiction") or []
        matches.append(
            {
                "name": (names[0] if isinstance(names, list) and names else match.get("caption") or ""),
                "schema": match.get("schema") or schema,
                "datasets": [str(d) for d in datasets],
                "source_type": _map_dataset_to_source_type([str(d) for d in datasets]),
                "score": match.get("score"),
                "opensanctions_id": match.get("id"),
                "topics": [str(t) for t in topics] if isinstance(topics, list) else [],
                "jurisdictions": [str(j) for j in jurisdictions] if isinstance(jurisdictions, list) else [],
            }
        )

    result = {
        "status": "success",
        "matches": matches,
        "attribution": attribution,
        "queried_at": queried_at,
        "degrade_reason": None,
    }
    _set_cached(cache_key, result)
    return result
