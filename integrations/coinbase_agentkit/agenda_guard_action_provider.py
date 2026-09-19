"""Coinbase AgentKit Action Provider: Agenda Financial Guard.

Provides an enterprise-grade pre-sign transaction firewall for AI agents using
Coinbase AgentKit (cdp-agentkit-core). Screens transactions in real-time against:
1. OFAC SDN & AML blacklists (Tornado Cash, Lazarus, Garantex).
2. Smart contract drainers & infinite token allowances.
3. Treasury velocity spending limits.
4. Adversarial prompt injections in transaction reasoning.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Optional

from agenda_intelligence.agent_financial_guard import (
    AgentFinancialGuard,
    FinancialGuardVerdict,
)

try:
    from pydantic import BaseModel, Field

    class CheckTransactionInput(BaseModel):  # type: ignore[no-redef]
        """Input arguments for transaction safety verification."""

        recipient: str = Field(..., description="Destination wallet or smart contract address (e.g. 0x...)")
        amount_usd: float = Field(..., description="Transaction amount evaluated in USD")
        network: str = Field(default="base", description="Blockchain network (default: base)")
        asset: str = Field(default="USDC", description="Asset symbol (default: USDC)")
        calldata: str = Field(default="0x", description="Hex calldata if calling a smart contract (default: 0x)")
        intent: str = Field(
            default="Autonomous agent transaction",
            description="Natural language explanation of why the agent is sending this transaction",
        )

except ImportError:
    from dataclasses import dataclass

    @dataclass
    class CheckTransactionInput:  # type: ignore[no-redef]
        """Input arguments for transaction safety verification."""

        recipient: str
        amount_usd: float
        network: str = "base"
        asset: str = "USDC"
        calldata: str = "0x"
        intent: str = "Autonomous agent transaction"


class AgendaFinancialGuardActionProvider:
    """Action Provider for Coinbase AgentKit enabling autonomous financial safety checks."""

    def __init__(
        self,
        endpoint: Optional[str] = None,
        max_single_limit_usd: float = 100.0,
        rolling_24h_limit_usd: float = 500.0,
        prefer_remote: bool = True,
    ) -> None:
        self.guard = AgentFinancialGuard(endpoint=endpoint) if endpoint else AgentFinancialGuard()
        self.policy_limits = {
            "max_single_limit_usd": max_single_limit_usd,
            "rolling_24h_limit_usd": rolling_24h_limit_usd,
        }
        self.prefer_remote = prefer_remote

    @property
    def name(self) -> str:
        return "agenda_financial_guard"

    def check_transaction_safety(
        self,
        recipient: str,
        amount_usd: float,
        network: str = "base",
        asset: str = "USDC",
        calldata: str = "0x",
        intent: str = "Autonomous agent transaction",
    ) -> str:
        """Evaluates whether a proposed on-chain transaction is safe to sign and broadcast."""
        verdict: FinancialGuardVerdict = self.guard.check_transaction(
            recipient_address=recipient,
            amount_usd=amount_usd,
            network=network,
            asset=asset,
            calldata=calldata,
            intent=intent,
            policy_limits=self.policy_limits,
            prefer_remote=self.prefer_remote,
        )

        response = {
            "decision": verdict.decision,
            "status": verdict.status,
            "risk_score": verdict.score,
            "is_safe": verdict.is_allowed,
            "violations": verdict.violations,
            "advisory": verdict.execution_advisory,
        }
        return json.dumps(response, indent=2)

    def wrap_wallet_provider(self, send_tx_fn: Callable[..., Any]) -> Callable[..., Any]:
        """Middleware wrapper around wallet_provider.send_transaction.

        Intercepts outgoing transactions and enforces zero-tolerance blocking
        if risk score exceeds threshold or recipient is blacklisted.
        """

        def guarded_send_transaction(*args: Any, **kwargs: Any) -> Any:
            recipient = kwargs.get("to") or (args[0] if len(args) > 0 else "")
            amount_usd = kwargs.get("value_usd", 0.0)
            calldata = kwargs.get("data") or kwargs.get("calldata", "0x")
            intent = kwargs.get("intent", "Guarded transaction execution")

            verdict = self.guard.check_transaction(
                recipient_address=str(recipient),
                amount_usd=float(amount_usd),
                calldata=str(calldata),
                intent=str(intent),
                policy_limits=self.policy_limits,
                prefer_remote=self.prefer_remote,
            )

            if not verdict.is_allowed:
                raise PermissionError(
                    f"[AgendaFinancialGuard BLOCKED] Transaction rejected (Risk Score: {verdict.score}/100): "
                    f"{'; '.join(verdict.violations)}"
                )

            return send_tx_fn(*args, **kwargs)

        return guarded_send_transaction
