"""Framework-agnostic agent integrations and guardrails for Agenda Intelligence.

Provides zero-dependency wrappers for integrating evidence-packet validation
and self-correction loops into agent pipelines (LangChain, LlamaIndex, CrewAI,
DSPy, or custom LLM loops).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)

from agenda_intelligence.services import build_repair_prompt, check_evidence_packet


@dataclass(frozen=True)
class EvidenceQuote:
    """Typed SDK representation of a source-bound quote."""

    source_id: str
    text: str

    def to_dict(self) -> Dict[str, str]:
        return {"source_id": self.source_id, "text": self.text}


@dataclass(frozen=True)
class EvidenceClaim:
    """Typed SDK representation of a claim in an evidence packet."""

    claim_id: str
    text: str
    source_ids: Sequence[str] = field(default_factory=tuple)
    quotes: Sequence[EvidenceQuote] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"claim_id": self.claim_id, "text": self.text}
        if self.source_ids:
            result["source_ids"] = list(self.source_ids)
        if self.quotes:
            result["quotes"] = [quote.to_dict() for quote in self.quotes]
        return result


@dataclass(frozen=True)
class EvidenceSource:
    """Typed SDK representation of caller-supplied source text."""

    source_id: str
    text: str
    title: Optional[str] = None
    url: Optional[str] = None

    def to_dict(self) -> Dict[str, str]:
        result = {"source_id": self.source_id, "text": self.text}
        if self.title is not None:
            result["title"] = self.title
        if self.url is not None:
            result["url"] = self.url
        return result


@dataclass(frozen=True)
class EvidencePacket:
    """Zero-dependency typed input that serializes to the stable JSON contract."""

    claims: Sequence[EvidenceClaim]
    sources: Sequence[EvidenceSource]
    packet_id: Optional[str] = None
    topic: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "claims": [claim.to_dict() for claim in self.claims],
            "sources": [source.to_dict() for source in self.sources],
        }
        if self.packet_id is not None:
            result["packet_id"] = self.packet_id
        if self.topic is not None:
            result["topic"] = self.topic
        return result


PacketInput = Union[Mapping[str, Any], EvidencePacket]


def _packet_dict(packet: PacketInput) -> Dict[str, Any]:
    if isinstance(packet, EvidencePacket):
        return packet.to_dict()
    return dict(packet)


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

    def check(self, packet: PacketInput) -> Dict[str, Any]:
        """Validate an evidence packet against the deterministic contract."""
        return check_evidence_packet(_packet_dict(packet))

    async def check_async(self, packet: PacketInput) -> Dict[str, Any]:
        """Run the CPU-bound deterministic check without blocking an event loop."""
        return await asyncio.to_thread(self.check, packet)

    def is_complete(self, check_result: Dict[str, Any]) -> bool:
        """Return True if the packet passed validation and is packet_complete."""
        if not check_result.get("valid"):
            return False
        response = check_result.get("response") or {}
        if self.strict:
            return response.get("packet_status") == "packet_complete"
        return response.get("packet_status") in ("packet_complete", "source_review_required")

    def get_repair_prompt(self, packet: PacketInput, check_result: Optional[Dict[str, Any]] = None) -> str:
        """Generate structured repair instructions for an LLM agent."""
        response = check_result.get("response") if check_result else None
        return build_repair_prompt(_packet_dict(packet), response)

    def validate_or_repair(
        self,
        initial_packet: PacketInput,
        llm_repair_fn: Callable[[str], PacketInput],
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
        current_packet = _packet_dict(initial_packet)
        repair_history: List[str] = []

        for _ in range(attempts + 1):
            check_result = self.check(current_packet)
            if self.is_complete(check_result):
                return current_packet, True, repair_history

            repair_prompt = self.get_repair_prompt(current_packet, check_result)
            repair_history.append(repair_prompt)

            if len(repair_history) > attempts:
                break

            current_packet = _packet_dict(llm_repair_fn(repair_prompt))

        return current_packet, False, repair_history

    async def validate_or_repair_async(
        self,
        initial_packet: PacketInput,
        llm_repair_fn: Callable[[str], Awaitable[PacketInput]],
        max_attempts: Optional[int] = None,
    ) -> Tuple[Dict[str, Any], bool, List[str]]:
        """Async self-correction loop for LangGraph and other event-loop pipelines."""
        attempts = max_attempts if max_attempts is not None else self.max_repair_attempts
        current_packet = _packet_dict(initial_packet)
        repair_history: List[str] = []

        for _ in range(attempts + 1):
            check_result = await self.check_async(current_packet)
            if self.is_complete(check_result):
                return current_packet, True, repair_history

            repair_prompt = self.get_repair_prompt(current_packet, check_result)
            repair_history.append(repair_prompt)
            if len(repair_history) > attempts:
                break
            current_packet = _packet_dict(await llm_repair_fn(repair_prompt))

        return current_packet, False, repair_history

    def as_langgraph_node(
        self,
        *,
        packet_key: str = "evidence_packet",
        result_key: str = "evidence_check",
    ) -> Callable[[Mapping[str, Any]], Awaitable[Dict[str, Any]]]:
        """Return a dependency-free async node compatible with LangGraph state updates."""

        async def check_node(state: Mapping[str, Any]) -> Dict[str, Any]:
            if packet_key not in state:
                raise KeyError(f"LangGraph state is missing {packet_key!r}")
            return {result_key: await self.check_async(state[packet_key])}

        return check_node


def create_evidence_packet(claims: List[Dict[str, Any]], sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Helper to construct an evidence packet request dictionary."""
    return {
        "claims": claims,
        "sources": sources,
    }


__all__ = [
    "EvidenceClaim",
    "EvidencePacket",
    "EvidencePacketGuardrail",
    "EvidenceQuote",
    "EvidenceSource",
    "create_evidence_packet",
]
