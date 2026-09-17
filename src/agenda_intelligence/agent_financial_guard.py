"""AgentFinancialGuard: Deterministic pre-sign transaction firewall for AI agents."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Optional

DEFAULT_ENDPOINT = "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/v1/agent-financial/pre-sign-check"

# Designated high-risk & sanctioned addresses (OFAC SDN, Lazarus Group, Tornado Cash)
DEFAULT_SANCTIONED_ADDRESSES = {
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",  # Tornado Cash router
    "0x8589427373d6d84e98730d7795d8f6f8731fda16",  # Tornado Cash 0.1 ETH
    "0x722122df12d4e14e13ac3b6895a86e84145b6967",  # Tornado Cash 1 ETH
    "0x090e53c44e8a9b6b1bca800e881455b921aec420",  # Lazarus Group
    "0x3cb4ca3c9dc0e02d139308e453974d1032528319",  # Lazarus Group
    "0x2f389ce8bd8ff92de3402ffce4691d17fc4f6535",  # Garantex deposit
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  # High-risk pool target
}

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+(instructions|rules|limits)", re.IGNORECASE),
    re.compile(r"drain\s+(the\s+)?(wallet|treasury|balance|funds)", re.IGNORECASE),
    re.compile(r"transfer\s+all\s+(funds|balance|tokens|crypto)", re.IGNORECASE),
    re.compile(r"override\s+(spending|velocity|policy)\s+limits", re.IGNORECASE),
    re.compile(r"bypass\s+(firewall|security|pre-sign|safeguards)", re.IGNORECASE),
    re.compile(r"exfiltrate\s+(keys|balance|private\s+key)", re.IGNORECASE),
]

INFINITE_APPROVE_HEX = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"


@dataclass
class FinancialGuardVerdict:
    """Evaluation verdict from the pre-sign financial firewall."""

    decision: str  # "allow" | "reject"
    status: str  # "decision_ready" | "escalate"
    score: int  # 0 - 100 risk score
    checks: dict[str, bool] = field(default_factory=dict)
    violations: list[str] = field(default_factory=list)
    execution_advisory: str = ""
    vizier_status: str = "evaluated"
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def is_allowed(self) -> bool:
        return self.decision == "allow"

    @property
    def is_blocked(self) -> bool:
        return self.decision == "reject"


class AgentFinancialGuard:
    """Deterministic pre-sign transaction firewall for autonomous AI agents.

    Protects agents equipped with wallets (Coinbase AgentKit, Stripe Agent Toolkit,
    Circle Programmable Wallets, Privy, ElizaOS) from wallet drainers, sanctions violations,
    runaway spending, and adversarial prompt injections before broadcasting.
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

    def check(
        self,
        transaction: dict[str, Any],
        intent: str | dict[str, Any],
        policy_limits: Optional[dict[str, Any]] = None,
        run_id: Optional[str] = None,
        prefer_remote: bool = True,
    ) -> FinancialGuardVerdict:
        """Run pre-sign security check on a proposed on-chain transaction."""
        intent_dict = intent if isinstance(intent, dict) else {"prompt": str(intent)}
        run_id_val = run_id or f"py-guard-{str(transaction.get('recipient', 'tx'))[:8]}"
        payload: dict[str, Any] = {
            "run_id": run_id_val,
            "transaction": transaction,
            "intent": intent_dict,
        }
        if policy_limits:
            payload["policy_limits"] = policy_limits

        if prefer_remote:
            try:
                return self._check_remote(payload)
            except Exception:
                if not self.local_fallback:
                    raise
                return self._check_local(payload)
        return self._check_local(payload)

    def _check_remote(self, payload: dict[str, Any]) -> FinancialGuardVerdict:
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "agenda-intelligence-python-sdk/1.10.0",
        }
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"

        req = urllib.request.Request(self.endpoint, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))

        verdict_data = body.get("financial_guard_verdict", body)
        return FinancialGuardVerdict(
            decision=verdict_data.get("decision", "reject"),
            status=verdict_data.get("status", "escalate"),
            score=verdict_data.get("score", 95),
            checks=verdict_data.get("checks", {}),
            violations=verdict_data.get("violations", []),
            execution_advisory=verdict_data.get("execution_advisory", ""),
            vizier_status=verdict_data.get("vizier_status", "edge_evaluated"),
            raw=body,
        )

    def _check_local(self, payload: dict[str, Any]) -> FinancialGuardVerdict:
        """Deterministic local evaluation fallback with identical edge rules."""
        tx = payload.get("transaction", {})
        intent = payload.get("intent", {})
        policies = payload.get("policy_limits", {})

        recipient = str(tx.get("recipient", "")).lower().strip()
        calldata = str(tx.get("calldata", "")).lower().strip()
        method = str(tx.get("method", "transfer")).lower().strip()
        amount_usd = float(tx.get("amount_usd", 0) or 0)
        prompt = str(intent.get("prompt", ""))

        violations: list[str] = []
        checks = {
            "sanctions_aml": True,
            "contract_security": True,
            "velocity_limits": True,
            "prompt_injection": True,
        }

        # 1. Sanctions check
        if recipient in DEFAULT_SANCTIONED_ADDRESSES:
            checks["sanctions_aml"] = False
            violations.append(f"Recipient address ({recipient}) is designated under OFAC SDN / sanctions blacklist.")

        # 2. Drainer calldata / infinite approval
        if method == "approve" and INFINITE_APPROVE_HEX in calldata:
            checks["contract_security"] = False
            violations.append(
                "Unconstrained infinite token approval (approve max uint256) detected. Potential wallet drainer vector."
            )

        # 3. Velocity / spending limits
        max_single = float(policies.get("max_single_limit_usd", 100))
        if amount_usd > max_single:
            checks["velocity_limits"] = False
            violations.append(
                f"Transaction amount (${amount_usd}) exceeds configured limit (${max_single}). Requires human step-up."
            )

        # 4. Prompt injection in reasoning
        for pattern in INJECTION_PATTERNS:
            if pattern.search(prompt):
                checks["prompt_injection"] = False
                violations.append(
                    f"Adversarial intent or prompt injection pattern detected in caller reasoning: '{pattern.pattern}'."
                )
                break

        has_violations = len(violations) > 0
        decision = "reject" if has_violations else "allow"
        status = "escalate" if has_violations else "decision_ready"
        score = 95 if has_violations else 10
        advisory = (
            "CRITICAL SECURITY BLOCK: Transaction violates compliance, AML, contract security, "
            "or intent boundaries. Execution forbidden."
            if has_violations
            else "Transaction verified through deterministic security policies. Ready to sign."
        )

        return FinancialGuardVerdict(
            decision=decision,
            status=status,
            score=score,
            checks=checks,
            violations=violations,
            execution_advisory=advisory,
            vizier_status="local_evaluated",
            raw={
                "decision": decision,
                "status": status,
                "score": score,
                "checks": checks,
                "violations": violations,
                "execution_advisory": advisory,
            },
        )
