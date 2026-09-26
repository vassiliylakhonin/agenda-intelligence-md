"""Agenda Intelligence: structured evidence-packet gate for AI output."""

__version__ = "1.13.0"

from agenda_intelligence.agent_financial_guard import (
    AgentFinancialGuard,
    FinancialGuardVerdict,
)
from agenda_intelligence.human_review import HumanReviewClient, HumanReviewError
from agenda_intelligence.m2m_escrow_arbiter import (
    ArbitrationRuling,
    M2MEscrowArbiter,
    PayoutBreakdown,
)

__all__ = [
    "__version__",
    "AgentFinancialGuard",
    "HumanReviewClient",
    "HumanReviewError",
    "FinancialGuardVerdict",
    "M2MEscrowArbiter",
    "ArbitrationRuling",
    "PayoutBreakdown",
]
