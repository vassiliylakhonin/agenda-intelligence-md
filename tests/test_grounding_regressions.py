"""False-positive grounding probes, including CLI/MCP and positive controls."""

import json
import os
import subprocess
import sys

import pytest

from agenda_intelligence import services
from agenda_intelligence.grounding import _numeric_fact_keys
from agenda_intelligence.mcp_stdio import handle_message


def packet(claim, sources):
    return {
        "claims": [{"claim_id": "c1", "text": claim, "source_ids": list(sources)}],
        "sources": [{"source_id": key, "text": text} for key, text in sources.items()],
    }


@pytest.mark.parametrize("negative", ["-5 percent", "−5 percent", "-$5 million", "$-5 million"])
def test_signed_value_differs_from_positive(negative):
    positive = negative.replace("-", "").replace("−", "")
    request = packet(f"The return was {negative}.", {"source": f"The return was {positive}."})
    response = services.check_evidence_packet(request)["response"]
    assert response["packet_status"] == "source_review_required"
    assert response["claims"][0]["lexical_support"]["unmatched_numbers"]
    assert response["owner_actions"]


@pytest.mark.parametrize("left,right", [("−5%", "-5 percent"), ("+5%", "5 percent"), ("-$5M", "-5000000 USD")])
def test_equivalent_signed_formats(left, right):
    assert _numeric_fact_keys(left) == _numeric_fact_keys(right)
    response = services.check_evidence_packet(packet(f"The return was {left}.", {"s": f"The return was {right}."}))
    assert response["response"]["packet_status"] == "packet_complete"


def test_unrelated_present_quote_does_not_upgrade_mcp_result():
    request = {
        "claims": [
            {
                "claim_id": "c1",
                "claim_text": "The regulator approved a merger.",
                "quotes": [{"corpus_id": "s", "quote": "Bananas are yellow."}],
            }
        ],
        "corpus": [{"corpus_id": "s", "text": "Bananas are yellow."}],
    }
    message = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": "grounded_check", "arguments": {"request_json": request}},
        }
    )
    assert message["result"]["isError"] is False
    response = json.loads(message["result"]["content"][0]["text"])["response"]
    assert response["results"][0]["quote_checks"][0]["status"] == "present"
    assert response["grounded_claim_count"] == 0
    assert response["owner_actions"]


@pytest.mark.parametrize("same_document", [False, True])
def test_number_from_unrelated_context_requires_review(same_document):
    texts = {
        "port": "Port project budget was 100 million USD.",
        "other": "An unrelated aircraft purchase cost 900 million USD.",
    }
    if same_document:
        texts = {"port": " ".join(texts.values())}
    request = packet("Port project budget was 900 million USD.", texts)
    assert services.check_evidence_packet(request)["response"]["packet_status"] == "source_review_required"
    grounded = {
        "claims": [{"claim_id": "c1", "claim_text": request["claims"][0]["text"]}],
        "corpus": [{"corpus_id": key, "text": text} for key, text in texts.items()],
    }
    response = services.grounded_check(grounded)["response"]
    assert response["grounded_claim_count"] == 0
    assert response["results"][0]["unmatched_numbers"]


def test_relevant_multiple_sources_preserve_numeric_support():
    request = packet(
        "Port budget was 900 million USD and railway budget was 100 million USD.",
        {"port": "Port budget was 900 million USD.", "rail": "Railway budget was 100 million USD."},
    )
    response = services.check_evidence_packet(request)["response"]
    assert response["claims"][0]["lexical_support"]["unmatched_numbers"] == []


def test_strict_cli_rejects_signed_mismatch(tmp_path):
    source = tmp_path / "request.json"
    source.write_text(json.dumps(packet("The return was -5 percent.", {"s": "The return was 5 percent."})))
    result = subprocess.run(
        [sys.executable, "-m", "agenda_intelligence.cli", "check", str(source), "--strict", "--format", "json"],
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    assert result.returncode == 1
    assert json.loads(result.stdout)["packet_status"] == "source_review_required"
