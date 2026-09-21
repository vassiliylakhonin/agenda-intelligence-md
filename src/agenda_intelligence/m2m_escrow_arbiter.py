"""M2MEscrowArbiter: Deterministic dispute resolution and settlement engine for AI agents."""

from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, Union

from .escrow_schema import validate_escrow_artifact

DEFAULT_ENDPOINT = "https://m2m-escrow-arbiter-a2a.vassiliy-lakhonin.workers.dev/v1/m2m-escrow/evaluate-dispute"


@dataclass
class PayoutBreakdown:
    """Mathematical allocation of escrow funds."""

    total_escrow_usd: float
    seller_payout_usd: float
    buyer_refund_usd: float
    arbiter_fee_usd: float


@dataclass
class ArbitrationRuling:
    """Binding arbitration ruling issued for an M2M escrow transaction."""

    ruling: str  # "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "PARTIAL_SETTLEMENT" | "ESCALATE_HUMAN"
    status: str  # "decision_ready" | "escalate"
    score: int  # 0 - 100
    escrow_id: str
    payout: PayoutBreakdown
    checks: dict[str, bool] = field(default_factory=dict)
    violations: list[str] = field(default_factory=list)
    execution_advisory: str = ""
    vizier_status: str = "edge_evaluated"
    vizier_clearance_receipt: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def is_released_to_seller(self) -> bool:
        return self.ruling == "RELEASE_TO_SELLER"

    @property
    def is_refunded_to_buyer(self) -> bool:
        return self.ruling == "REFUND_TO_BUYER"

    @property
    def is_partial_settlement(self) -> bool:
        return self.ruling == "PARTIAL_SETTLEMENT"

    @property
    def payout_breakdown(self) -> PayoutBreakdown:
        return self.payout


class M2MEscrowArbiter:
    """Deterministic dispute arbiter for Agent-to-Agent (M2M) autonomous commerce.

    Verifies delivery artifacts against contract specifications (SHA-256 hashes,
    JSON Schema compliance, contract deadlines, and SLO completeness thresholds),
    issuing binding payout allocations with automated fee settlement.
    """

    def __init__(
        self,
        endpoint: str = DEFAULT_ENDPOINT,
        bearer_token: Optional[str] = None,
        timeout: float = 5.0,
        local_fallback: bool = True,
    ) -> None:
        self.endpoint = endpoint
        self.bearer_token = bearer_token
        self.timeout = timeout
        self.local_fallback = local_fallback

    def evaluate_dispute(
        self,
        escrow_id: Union[str, dict[str, Any]],
        deal_terms: Optional[dict[str, Any]] = None,
        specification: Optional[dict[str, Any]] = None,
        delivery_submission: Optional[dict[str, Any]] = None,
        dispute_claim: Optional[dict[str, Any]] = None,
        prefer_remote: bool = True,
    ) -> ArbitrationRuling:
        """Evaluate an M2M escrow dispute and return binding arbitration ruling.

        Can be called with either a single dict payload matching request schema or
        discrete arguments for escrow_id, deal_terms, specification, delivery_submission.
        """
        if isinstance(escrow_id, dict):
            payload = dict(escrow_id)
        else:
            if deal_terms is None or specification is None or delivery_submission is None:
                raise TypeError("evaluate_dispute requires 'deal_terms', 'specification', and 'delivery_submission'")
            payload = {
                "escrow_id": escrow_id,
                "deal_terms": deal_terms,
                "specification": specification,
                "delivery_submission": delivery_submission,
            }
            if dispute_claim:
                payload["dispute_claim"] = dispute_claim

        # Enforce this locally even when a legacy remote deployment is selected.
        # A remote schema_verified flag must not bypass the current validator.
        spec = payload.get("specification", {})
        sub = payload.get("delivery_submission", {})
        if "expected_schema" in spec:
            validation, _ = validate_escrow_artifact(
                spec["expected_schema"], sub.get("artifact_data"), "artifact_data" in sub
            )
            if validation != "valid":
                return self._evaluate_local(payload)

        if prefer_remote:
            try:
                return self._evaluate_remote(payload)
            except Exception:
                if not self.local_fallback:
                    raise
                return self._evaluate_local(payload)
        return self._evaluate_local(payload)

    def _evaluate_remote(self, payload: dict[str, Any]) -> ArbitrationRuling:
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "agenda-intelligence-python-sdk/1.12.0",
        }
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"

        req = urllib.request.Request(self.endpoint, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))

        ruling_data = body.get("arbitration_ruling", body)
        if not isinstance(ruling_data, dict):
            raise ValueError("Invalid escrow ruling")
        # No remote attestation is trusted until a signature and binding
        # protocol is implemented; this includes legacy response aliases.
        for item in (body, ruling_data):
            item["vizier_status"] = "attestation_unavailable"
            item["vizier_clearance_receipt"] = None
        payout_dict = ruling_data.get("payout_breakdown", {})
        payout = PayoutBreakdown(
            total_escrow_usd=float(payout_dict.get("total_escrow_usd", 0.0)),
            seller_payout_usd=float(payout_dict.get("seller_payout_usd", 0.0)),
            buyer_refund_usd=float(payout_dict.get("buyer_refund_usd", 0.0)),
            arbiter_fee_usd=float(payout_dict.get("arbiter_fee_usd", 0.0)),
        )

        return ArbitrationRuling(
            ruling=ruling_data.get("ruling", "REFUND_TO_BUYER"),
            status=ruling_data.get("status", "escalate"),
            score=int(ruling_data.get("score", 0)),
            escrow_id=ruling_data.get("escrow_id", payload.get("escrow_id", "")),
            payout=payout,
            checks=ruling_data.get("checks", {}),
            violations=ruling_data.get("violations", []),
            execution_advisory=ruling_data.get("execution_advisory", ""),
            vizier_status=ruling_data.get("vizier_status", "edge_evaluated"),
            vizier_clearance_receipt=ruling_data.get("vizier_clearance_receipt"),
            raw=body,
        )

    def _evaluate_local(self, payload: dict[str, Any]) -> ArbitrationRuling:
        """Deterministic local arbitration mirroring Cloudflare Edge engine logic."""
        terms = payload.get("deal_terms", {})
        spec = payload.get("specification", {})
        sub = payload.get("delivery_submission", {})

        violations: list[str] = []
        evidence_gaps: list[str] = []
        needs_review = False

        # 1. Deadline check
        deadline_str = terms.get("deadline_utc", "")
        submitted_str = sub.get("submitted_at", "")
        deadline_honored = True

        try:
            deadline_dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
            submitted_dt = datetime.fromisoformat(submitted_str.replace("Z", "+00:00"))
            if submitted_dt > deadline_dt:
                deadline_honored = False
                delay_sec = int((submitted_dt - deadline_dt).total_seconds())
                violations.append(f"Deadline breach: deliverable submitted {delay_sec}s past contract deadline.")
        except Exception:
            deadline_honored = False
            evidence_gaps.append("Unable to parse contract deadline or submission timestamp.")
            needs_review = True

        # 2. Hash integrity check
        exp_hash = (spec.get("expected_artifact_sha256") or "").lower().strip()
        act_hash = (sub.get("artifact_sha256") or "").lower().strip()
        hash_verified = True

        if exp_hash:
            if not act_hash and sub.get("artifact_data"):
                raw_bytes = json.dumps(sub["artifact_data"]).encode("utf-8")
                act_hash = hashlib.sha256(raw_bytes).hexdigest().lower()

            if not act_hash:
                hash_verified = False
                violations.append("Missing artifact SHA-256 hash in delivery submission.")
            elif act_hash != exp_hash:
                hash_verified = False
                violations.append(f"Cryptographic hash mismatch: expected '{exp_hash}', received '{act_hash}'.")

        # A digest does not supply the actual JSON instance for schema validation.
        schema_verified = True
        if "expected_schema" in spec:
            validation, errors = validate_escrow_artifact(
                spec["expected_schema"], sub.get("artifact_data"), "artifact_data" in sub
            )
            schema_verified = validation == "valid"
            if validation == "invalid":
                violations.extend(errors)
            elif validation == "unverified":
                evidence_gaps.extend(errors)
                needs_review = True

        # 4. SLO & delivery percentage
        telemetry = sub.get("telemetry", {})
        total_items = telemetry.get("total_items", 0)
        valid_items = telemetry.get("valid_items", total_items)
        delivery_pct = 100.0
        if total_items > 0:
            delivery_pct = min(100.0, max(0.0, (valid_items / total_items) * 100.0))

        min_pct = float(spec.get("min_valid_records_pct", 95.0))
        slo_verified = delivery_pct >= min_pct
        if not slo_verified:
            violations.append(
                f"SLO threshold failure: deliverable validity score {delivery_pct:.1f}% "
                f"is below contract minimum {min_pct:.1f}%."
            )

        # 5. Payout math
        total_escrow = float(terms.get("amount_usd", 0.0))
        fee_pct = float(terms.get("arbitration_fee_pct", 1.0))
        arbiter_fee = round(total_escrow * (fee_pct / 100.0), 2)
        net_pool = max(0.0, total_escrow - arbiter_fee)

        is_complete_failure = not deadline_honored or not hash_verified or not schema_verified
        policy = terms.get("arbitration_policy", "all_or_nothing")

        if is_complete_failure:
            ruling = "REFUND_TO_BUYER"
            status = "decision_ready"
            score = 10
            seller_payout = 0.0
            buyer_refund = net_pool
            advisory = "CRITICAL BREACH: Contract specification or deadline violated. Escrow refunded to buyer."
        elif not slo_verified:
            if policy == "pro_rata" and delivery_pct > 0:
                ruling = "PARTIAL_SETTLEMENT"
                status = "decision_ready"
                score = int(delivery_pct)
                seller_payout = round(net_pool * (delivery_pct / 100.0), 2)
                buyer_refund = round(net_pool - seller_payout, 2)
                advisory = (
                    f"PRO-RATA SETTLEMENT: Verified {delivery_pct:.1f}% deliverable completion. "
                    "Proportional payout released to seller, remainder refunded to buyer."
                )
            else:
                ruling = "REFUND_TO_BUYER"
                status = "decision_ready"
                score = 25
                seller_payout = 0.0
                buyer_refund = net_pool
                advisory = "ALL-OR-NOTHING POLICY: Deliverable failed minimum SLO threshold. Escrow refunded to buyer."
        else:
            ruling = "RELEASE_TO_SELLER"
            status = "decision_ready"
            score = 95
            seller_payout = net_pool
            buyer_refund = 0.0
            advisory = "Deliverable verified deterministically against contract specification. Full release approved."

        if needs_review:
            ruling = "ESCALATE_HUMAN"
            status = "not_decision_ready"
            score = 0
            seller_payout = buyer_refund = arbiter_fee = 0.0
            advisory = (
                "Required evidence could not be verified. Hold escrow pending human review; no payout is authorized."
            )

        payout = PayoutBreakdown(
            total_escrow_usd=total_escrow,
            seller_payout_usd=seller_payout,
            buyer_refund_usd=buyer_refund,
            arbiter_fee_usd=arbiter_fee,
        )

        checks = {
            "deadline_honored": deadline_honored,
            "hash_verified": hash_verified,
            "schema_verified": schema_verified,
            "slo_verified": slo_verified,
        }

        return ArbitrationRuling(
            ruling=ruling,
            status=status,
            score=score,
            escrow_id=str(payload.get("escrow_id", "")),
            payout=payout,
            checks=checks,
            violations=violations,
            execution_advisory=advisory,
            vizier_status="local_evaluated",
            raw={
                "ruling": ruling,
                "status": status,
                "score": score,
                "payout": {
                    "total_escrow_usd": total_escrow,
                    "seller_payout_usd": seller_payout,
                    "buyer_refund_usd": buyer_refund,
                    "arbiter_fee_usd": arbiter_fee,
                },
                "checks": checks,
                "violations": violations,
                "evidence_gaps": evidence_gaps,
                "human_review_required": True,
                "not_advice_notice": "Evaluation of supplied evidence only; not settlement authorization.",
            },
        )
