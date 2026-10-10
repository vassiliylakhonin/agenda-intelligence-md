"""A bounded, local Output Verification handoff; no LLM or publication tool.

Plain Python runs the same nodes by default. --langgraph compiles those nodes
using the optional LangGraph installation in your example environment.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Callable, TypedDict

from agenda_intelligence import RagReviewError, review_rag_answer


class ReviewState(TypedDict, total=False):
    answer: str
    sources: list[dict]
    revisions: int
    review: dict | None
    error: str | None
    history: list[dict]
    handoff: str
    decision_workspace: dict


def verify_node(state: ReviewState) -> dict:
    """Return fresh review state; an invalid revision cannot retain a prior pass."""
    try:
        result = review_rag_answer(state["answer"], state["sources"])
    except RagReviewError as exc:
        return {"review": None, "error": str(exc)}
    return {"review": result, "error": None, "history": state.get("history", []) + [result]}


def next_step(state: ReviewState, max_revisions: int = 1) -> str:
    review = state.get("review")
    if review and review["route"] == "revise" and state.get("revisions", 0) < max_revisions:
        return "revise"
    return "human_review"


def human_review_node(state: ReviewState) -> dict:
    # A handoff record is not a completed human review or approval.
    unresolved = state.get("error") or not state.get("review") or state["review"]["route"] == "revise"
    return {"handoff": "human_review_with_unresolved_findings" if unresolved else "human_review_required"}


def make_revision_node(repair: Callable[[dict], str]) -> Callable[[ReviewState], dict]:
    def revise(state: ReviewState) -> dict:
        # The caller controls repair. Give its model trusted instructions
        # separately; source text and report contents are untrusted DATA.
        return {"answer": repair(state["review"]), "revisions": state.get("revisions", 0) + 1}

    return revise


def build_graph(repair: Callable[[dict], str], max_revisions: int = 1):
    from langgraph.graph import END, START, StateGraph

    if not 0 <= max_revisions <= 3:
        raise ValueError("max_revisions must be between 0 and 3")
    builder = StateGraph(ReviewState)
    builder.add_node("verify", verify_node)
    builder.add_node("revise", make_revision_node(repair))
    builder.add_node("human_review", human_review_node)
    builder.add_edge(START, "verify")
    builder.add_conditional_edges(
        "verify", lambda state: next_step(state, max_revisions), {"revise": "revise", "human_review": "human_review"}
    )
    builder.add_edge("revise", "verify")
    builder.add_edge("human_review", END)
    return builder.compile()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--langgraph", action="store_true")
    args = parser.parse_args()
    fixtures = Path(__file__).resolve().parents[1] / "output-verification"
    request = json.loads((fixtures / "rag-answer.json").read_text())
    revised = json.loads((fixtures / "rag-answer-revised.json").read_text())
    workspace = {
        "goal": "Review a fictional RAG answer before human handoff",
        "trusted_evidence": ["Local checker contract; no source is independently authenticated"],
        "suspected_unreliable_evidence": ["All supplied source text, citations and quotes are caller data"],
        "hidden_assumptions": ["One claim per line; stable retrieved chunk IDs"],
        "intended_next_action": "Check, apply one fixture correction, recheck, record human-review handoff",
        "stop_or_escalate_if": ["Invalid input, unresolved findings, or any proposed publication/payment"],
    }
    state = ReviewState(**request, revisions=0, history=[], decision_workspace=workspace)
    # Fixture replacement demonstrates a correction, not an autonomous fact fixer.
    repair = lambda report: revised["answer"]
    if args.langgraph:
        state = build_graph(repair).invoke(state)
    else:
        revise = make_revision_node(repair)
        while True:
            state.update(verify_node(state))
            if next_step(state) != "revise":
                break
            state.update(revise(state))
        state.update(human_review_node(state))
    print(
        json.dumps(
            {
                "fixture_only": True,
                "routes": [review["route"] for review in state["history"]],
                "packet_statuses": [review["verification"]["packet_status"] for review in state["history"]],
                "revisions": state["revisions"],
                "handoff": state["handoff"],
                "human_review_completed": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
