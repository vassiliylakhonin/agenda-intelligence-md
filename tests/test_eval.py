import json

from agenda_intelligence.eval import format_score, score_brief


def test_score_brief_returns_weighted_dimensions():
    brief = {
        "bottom_line": "Treat this as a compliance-relevant signal.",
        "signal_classification": "compliance_relevant_development",
        "what_changed": "The issue moved from policy discussion toward implementation detail.",
        "why_it_matters": "Implementation detail can become the compliance baseline.",
        "affected_actors": ["regulated companies", "compliance teams"],
        "main_uncertainty": "Whether guidance becomes the practical enforcement baseline.",
        "scenarios": [
            {
                "name": "Base case",
                "description": "Companies adjust documentation before deadlines.",
                "indicators": ["agency guidance", "compliance deadline"],
            }
        ],
        "watch_next": ["regulator guidance", "first enforcement action"],
        "evidence_mode": "mixed",
        "confidence": {
            "level": "medium",
            "score": 0.7,
            "reasoning": "Evidence is partial.",
        },
    }

    result = score_brief(brief, evidence_pack=valid_evidence_pack())

    assert result["score"] >= 80
    assert result["max_score"] == 100
    assert set(result["dimensions"]) == {
        "relevance",
        "evidence_support",
        "completeness",
        "actionability",
        "clarity",
    }
    assert "claims supported" in result["dimensions"]["evidence_support"]["feedback"]


def test_format_score_is_cli_friendly():
    result = score_brief(
        {
            "bottom_line": "Monitor developments.",
            "signal_classification": "weak_signal",
            "what_changed": "Something changed.",
            "main_uncertainty": "Whether it matters.",
            "watch_next": ["guidance"],
            "evidence_mode": "reasoning_only",
            "confidence": "low",
        }
    )

    output = format_score(result)

    assert output.startswith("score: ")
    assert "evidence_support:" in output
    assert "does not verify factual truthfulness" in output


def test_score_result_is_json_serializable():
    result = score_brief(
        {
            "bottom_line": "Treat this as a signal.",
            "signal_classification": "signal",
            "what_changed": "A policy moved into guidance.",
            "main_uncertainty": "Whether enforcement follows.",
            "watch_next": ["guidance", "deadline"],
        }
    )

    json.dumps(result)


def test_evidence_pack_penalizes_unsupported_claims():
    brief = {
        "bottom_line": "Treat this as a signal.",
        "signal_classification": "signal",
        "what_changed": "A policy moved into guidance.",
        "main_uncertainty": "Whether enforcement follows.",
        "watch_next": ["guidance", "deadline"],
        "evidence_mode": "mixed",
    }
    weak_evidence = {
        "topic": "test",
        "evidence_mode": "mixed",
        "claims": [
            {
                "claim": "Unsupported implementation claim.",
                "support_status": "unsupported",
                "sources": [],
            }
        ],
        "unsupported_claims": ["Unsupported implementation claim."],
        "required_but_missing_sources": ["legal text"],
    }

    result = score_brief(brief, evidence_pack=weak_evidence)

    assert result["dimensions"]["evidence_support"]["score"] < 10
    assert "unsupported_claims=1" in result["dimensions"]["evidence_support"]["feedback"]


def valid_evidence_pack():
    return {
        "topic": "test",
        "evidence_mode": "mixed",
        "claims": [
            {
                "claim": "The policy moved toward implementation detail.",
                "support_status": "supported",
                "sources": [
                    {
                        "name": "Official guidance",
                        "source_type": "official",
                        "freshness": "current",
                        "supports": ["implementation detail"],
                        "limits": ["does not prove enforcement outcome"],
                    }
                ],
            }
        ],
        "unsupported_claims": [],
    }
