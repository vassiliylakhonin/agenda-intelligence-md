"""Exercise the configured proof against free routing and paid tool responses."""

import importlib.util
import io
import json
from pathlib import Path
from urllib.parse import urlparse

import pytest

PROOF = Path(__file__).resolve().parents[1] / "scripts/fleet_health/proof_configured_worker.py"


class Response(io.BytesIO):
    def __init__(self, data, status=200):
        super().__init__(json.dumps(data).encode())
        self.status = status


def load_proof():
    spec = importlib.util.spec_from_file_location("configured_health_fixture", PROOF)
    proof = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(proof)
    return proof


def run_fixture(monkeypatch, profile, *, auth=False, failure=None):
    proof = load_proof()
    router = {"agenda": "strategic_risk_triage", "corridor_sanctions_assistant": "corridor_sanctions_assistant"}.get(
        profile
    )
    paid = "screen_dual_use_hs_code" if profile == "corridor_sanctions_assistant" else "agent_output_verification"
    names = [router, "corridor_bankability_screen"] if profile == "agenda" else [router, paid] if router else [paid]
    offers = [{"tool": name, "payment_required": name != router} for name in names]
    expected_tool = router if profile == "agenda" else paid
    expected_status = 401 if auth else 200 if profile == "agenda" else 402
    seen = []

    def fetch(request, **kwargs):
        seen.append(request)
        path = urlparse(request.full_url).path
        if path == "/health":
            return Response({"profile": profile})
        if path == "/.well-known/x402":
            return Response(
                {
                    "offers": offers,
                    "x_agenda_access": {
                        "billing_mode": "pay_per_call",
                        "authentication": "bearer_required" if auth else "none",
                        **({"free_routing": {"tool": router}} if router else {}),
                    },
                }
            )
        body = json.loads(request.data)
        if body["method"] == "tools/list":
            return Response(
                {
                    "result": {
                        "tools": [
                            {
                                "name": name,
                                "_meta": {"com.agenda/readiness": {"example_arguments": {"text": "Synthetic"}}},
                            }
                            for name in names
                        ]
                    }
                }
            )
        assert body["params"]["name"] == expected_tool
        result = {"isError": failure == "tool_error", "structuredContent": {"authorization_granted": False}}
        if failure == "authorized":
            result["structuredContent"]["authorization_granted"] = True
        if failure == "missing_structured":
            del result["structuredContent"]
        return Response({"result": result} if expected_status == 200 else {"error": "admission"}, expected_status)

    monkeypatch.setattr(proof.urllib.request, "urlopen", fetch)
    proof.check_worker(
        {"agenda": "agenda-intelligence-a2a", "corridor_sanctions_assistant": "corridor-sanctions-assistant-a2a"}.get(
            profile, "agent-output-verification-a2a"
        )
    )
    return seen


@pytest.mark.parametrize(
    "profile,auth",
    [
        ("agenda", False),
        ("corridor_sanctions_assistant", False),
        ("agent_output_verification", False),
        ("agenda", True),
    ],
)
def test_health_uses_actual_operation_admission_without_changing_identity(monkeypatch, profile, auth):
    requests = run_fixture(monkeypatch, profile, auth=auth)
    assert len(requests) == 4
    for request in requests:
        assert request.get_header("X-client-id") == "agenda-owner-configured-fleet-health"
        assert not request.has_header("User-agent")
        assert urlparse(request.full_url).hostname.endswith("agendamcp.dpdns.org")


@pytest.mark.parametrize("failure", ["tool_error", "authorized", "missing_structured"])
def test_free_routing_health_rejects_success_status_with_unsafe_or_missing_result(monkeypatch, failure):
    with pytest.raises(AssertionError):
        run_fixture(monkeypatch, "agenda", failure=failure)
