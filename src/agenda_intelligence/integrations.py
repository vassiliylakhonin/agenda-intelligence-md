"""Framework-agnostic agent integrations and guardrails for Agenda Intelligence.

Provides zero-dependency wrappers for integrating evidence-packet validation
and self-correction loops into agent pipelines (LangChain, LlamaIndex, CrewAI,
DSPy, or custom LLM loops).
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

from agenda_intelligence.services import build_repair_prompt, check_evidence_packet


class EvidencePacketGuardrail:
    """Guardrail for verifying and self-correcting evidence packets in agent pipelines.

    Examples
    --------
    >>> guardrail = EvidencePacketGuardrail(strict=True)
    >>> result = guardrail.check(packet_json)
    >>> if not guardrail.is_complete(result):
    ...     prompt = guardrail.get_repair_prompt(packet_json, result)
    ...     # Feed prompt back to LLM to revise output
    """

    def __init__(self, strict: bool = True, max_repair_attempts: int = 2) -> None:
        self.strict = strict
        self.max_repair_attempts = max_repair_attempts

    def check(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        """Validate an evidence packet against the deterministic contract."""
        return check_evidence_packet(packet)

    def is_complete(self, check_result: Dict[str, Any]) -> bool:
        """Return True if the packet passed validation and is packet_complete."""
        if not check_result.get("valid"):
            return False
        response = check_result.get("response") or {}
        if self.strict:
            return response.get("packet_status") == "packet_complete"
        return response.get("packet_status") in ("packet_complete", "source_review_required")

    def get_repair_prompt(self, packet: Dict[str, Any], check_result: Optional[Dict[str, Any]] = None) -> str:
        """Generate structured repair instructions for an LLM agent."""
        response = check_result.get("response") if check_result else None
        return build_repair_prompt(packet, response)

    def validate_or_repair(
        self,
        initial_packet: Dict[str, Any],
        llm_repair_fn: Callable[[str], Dict[str, Any]],
        max_attempts: Optional[int] = None,
    ) -> Tuple[Dict[str, Any], bool, List[str]]:
        """Run an automated self-correction loop with the supplied LLM function.

        Parameters
        ----------
        initial_packet : dict
            Initial evidence packet request JSON.
        llm_repair_fn : callable
            A callable that takes a repair prompt (str) and returns a revised packet (dict).
        max_attempts : int, optional
            Maximum number of repair iterations (defaults to self.max_repair_attempts).

        Returns
        -------
        tuple
            (final_packet, is_complete, list_of_repair_prompts)
        """
        attempts = max_attempts if max_attempts is not None else self.max_repair_attempts
        current_packet = initial_packet
        repair_history: List[str] = []

        for _ in range(attempts + 1):
            check_result = self.check(current_packet)
            if self.is_complete(check_result):
                return current_packet, True, repair_history

            repair_prompt = self.get_repair_prompt(current_packet, check_result)
            repair_history.append(repair_prompt)

            if len(repair_history) > attempts:
                break

            current_packet = llm_repair_fn(repair_prompt)

        return current_packet, False, repair_history


def create_evidence_packet(claims: List[Dict[str, Any]], sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Helper to construct an evidence packet request dictionary."""
    return {
        "claims": claims,
        "sources": sources,
    }
