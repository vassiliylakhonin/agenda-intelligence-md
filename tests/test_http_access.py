"""Access control, metering and CORS for the portable HTTP shell.

These tests cover the half of the shell that decides who may ask, rather than
the half that decides what the answer is. A misconfigured policy must fail at
startup, an unknown caller must be refused, a caller that spends its window must
stay refused until the window turns, and the usage ledger must count what an
operator would bill against.
"""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from agenda_intelligence.http_access import (
    AccessPolicy,
    PolicyError,
    RateLimiter,
    UsageLedger,
    bearer,
    request_id,
)
from agenda_intelligence.http_api import AgendaIntelligenceHTTPHandler, handle_get


def test_open_mode_is_the_default_and_says_so():
    policy = AccessPolicy.from_env({})

    assert policy.open_mode is True
    assert policy.describe()["auth"] == "open"
    assert policy.client_for(None) == "anonymous"
    assert handle_get("/readyz", policy)[1]["access"]["auth"] == "open"


def test_configured_keys_identify_their_client_and_reject_everything_else():
    policy = AccessPolicy.from_env({"AGENDA_INTELLIGENCE_API_KEYS": "acme:secret-a, globex:secret-b"})

    assert policy.open_mode is False
    assert policy.client_for("Bearer secret-a") == "acme"
    assert policy.client_for("bearer secret-b") == "globex"
    assert policy.client_for("Bearer secret-c") is None
    assert policy.client_for("Basic secret-a") is None
    assert policy.client_for(None) is None
    # The description is safe to print at startup and to serve on /readyz.
    described = json.dumps(policy.describe())
    assert "secret-a" not in described
    assert sorted(policy.describe()["clients"]) == ["acme", "globex"]


@pytest.mark.parametrize(
    "env, fragment",
    [
        ({"AGENDA_INTELLIGENCE_API_KEYS": "no-colon"}, "client:secret"),
        ({"AGENDA_INTELLIGENCE_API_KEYS": "a:one,b:one"}, "reuses one secret"),
        ({"AGENDA_INTELLIGENCE_REQUIRE_AUTH": "1"}, "REQUIRE_AUTH"),
        ({"AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE": "many"}, "must be an integer"),
        ({"AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE": "-1"}, "must not be negative"),
        ({"AGENDA_INTELLIGENCE_CORS_ORIGINS": "*"}, "does not accept"),
        ({"AGENDA_INTELLIGENCE_CORS_ORIGINS": "example.com"}, "full origins"),
    ],
)
def test_a_policy_that_cannot_be_enforced_fails_at_startup(env, fragment):
    with pytest.raises(PolicyError) as excinfo:
        AccessPolicy.from_env(env)
    assert fragment in str(excinfo.value)


def test_require_auth_is_satisfied_by_keys():
    policy = AccessPolicy.from_env(
        {"AGENDA_INTELLIGENCE_REQUIRE_AUTH": "1", "AGENDA_INTELLIGENCE_API_KEYS": "acme:secret"}
    )
    assert policy.open_mode is False


def test_cors_headers_are_sent_only_to_a_named_origin():
    policy = AccessPolicy.from_env({"AGENDA_INTELLIGENCE_CORS_ORIGINS": "https://app.example.com"})

    allowed = dict(policy.cors_headers("https://app.example.com"))
    assert allowed["access-control-allow-origin"] == "https://app.example.com"
    assert allowed["vary"] == "origin"
    assert policy.cors_headers("https://evil.example.com") == []
    assert policy.cors_headers(None) == []


def test_bearer_parsing():
    assert bearer("Bearer abc") == "abc"
    assert bearer("  bearer   abc  ") == "abc"
    assert bearer("Token abc") == ""
    assert bearer(None) == ""


def test_rate_limiter_refuses_for_the_rest_of_the_window_then_resets():
    now = [0.0]
    limiter = RateLimiter(2, clock=lambda: now[0])

    assert limiter.check("acme")[:2] == (True, 1)
    assert limiter.check("acme")[:2] == (True, 0)

    allowed, remaining, retry_after = limiter.check("acme")
    assert allowed is False
    assert remaining == 0
    assert 0 < retry_after <= 60

    # Another client has its own window.
    assert limiter.check("globex")[0] is True

    now[0] = 61.0
    assert limiter.check("acme")[0] is True


def test_rate_limit_of_zero_is_off_and_says_so():
    limiter = RateLimiter(0)
    assert limiter.enabled is False
    assert limiter.check("acme") == (True, -1, 0)


def test_usage_ledger_counts_answers_and_refusals_separately():
    ledger = UsageLedger(clock=lambda: 1000.0)
    ledger.record("acme", "/v1/audit-claims", 200)
    ledger.record("acme", "/v1/audit-claims", 400)
    ledger.record("acme", "/v1/audit-claims", 429)
    ledger.record("acme", "/v1/audit-claims", 500)
    ledger.record("globex", "/v1/score", 200)

    rows = {(row["client"], row["endpoint"]): row for row in ledger.snapshot()["rows"]}
    acme = rows[("acme", "/v1/audit-claims")]
    assert acme["requests"] == 4
    assert acme["ok"] == 1
    assert acme["client_error"] == 1
    assert acme["rate_limited"] == 1
    assert acme["server_error"] == 1
    assert acme["last_seen"] == 1000.0
    assert rows[("globex", "/v1/score")]["ok"] == 1


def test_request_id_echoes_a_safe_value_and_mints_one_otherwise():
    assert request_id("abc-123_x.y") == "abc-123_x.y"
    assert request_id("has space") != "has space"
    assert request_id("x" * 300) != "x" * 300
    assert len(request_id(None)) == 32


class _Server:
    """A real socket, so the wiring is tested and not just the pieces."""

    def __init__(self, policy: AccessPolicy):
        class Handler(AgendaIntelligenceHTTPHandler):
            pass

        Handler.policy = policy
        Handler.limiter = RateLimiter(policy.rate_limit_per_minute)
        Handler.ledger = UsageLedger()
        self.handler = Handler
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def call(self, path, method="GET", token=None, origin=None, body=None):
        request = urllib.request.Request(self.url + path, method=method)
        if token:
            request.add_header("authorization", f"Bearer {token}")
        if origin:
            request.add_header("origin", origin)
        if body is not None:
            request.add_header("content-type", "application/json")
            request.data = json.dumps(body).encode()
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                raw = response.read()
                return response.status, dict(response.headers), json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            return exc.code, dict(exc.headers), json.loads(raw) if raw else {}

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


@pytest.fixture
def server():
    policy = AccessPolicy.from_env(
        {
            "AGENDA_INTELLIGENCE_API_KEYS": "acme:secret-a",
            "AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE": "3",
            "AGENDA_INTELLIGENCE_CORS_ORIGINS": "https://app.example.com",
            "AGENDA_INTELLIGENCE_ADMIN_KEY": "admin-secret",
        }
    )
    instance = _Server(policy)
    yield instance
    instance.close()


def test_health_answers_without_a_key_but_the_service_does_not(server):
    status, _, body = server.call("/healthz")
    assert status == 200
    assert body["ok"] is True

    status, headers, body = server.call("/v1/score", method="POST", body={"before_text": "a", "after_text": "b"})
    assert status == 401
    assert body["error"] == "Missing or unknown API key"
    assert headers["www-authenticate"].startswith("Bearer")
    assert headers["x-request-id"]


def test_a_known_key_is_served_metered_and_then_limited(server):
    payload = {"before_text": "a", "after_text": "b"}

    status, headers, _ = server.call("/v1/score", method="POST", token="secret-a", body=payload)
    assert status == 200
    assert headers["x-ratelimit-limit"] == "3"
    assert headers["x-ratelimit-remaining"] == "2"
    assert headers["x-content-type-options"] == "nosniff"

    server.call("/v1/score", method="POST", token="secret-a", body=payload)
    server.call("/v1/score", method="POST", token="secret-a", body=payload)

    status, headers, body = server.call("/v1/score", method="POST", token="secret-a", body=payload)
    assert status == 429
    assert body["limit_per_minute"] == 3
    assert int(headers["retry-after"]) >= 1

    status, _, usage = server.call("/usage", token="admin-secret")
    assert status == 200
    row = next(r for r in usage["rows"] if r["endpoint"] == "/v1/score")
    assert row["client"] == "acme"
    assert row["ok"] == 3
    assert row["rate_limited"] == 1


def test_usage_needs_the_admin_key_not_a_client_key(server):
    assert server.call("/usage", token="secret-a")[0] == 401
    assert server.call("/usage")[0] == 401
    assert server.call("/usage", token="admin-secret")[0] == 200


def test_preflight_is_answered_for_a_named_origin_and_refused_otherwise(server):
    status, headers, _ = server.call("/v1/score", method="OPTIONS", origin="https://app.example.com")
    assert status == 204
    assert headers["access-control-allow-origin"] == "https://app.example.com"

    status, headers, _ = server.call("/v1/score", method="OPTIONS", origin="https://evil.example.com")
    assert status == 403
    assert "access-control-allow-origin" not in {k.lower() for k in headers}


def test_usage_is_absent_without_an_admin_key():
    policy = AccessPolicy.from_env({"AGENDA_INTELLIGENCE_API_KEYS": "acme:secret-a"})
    instance = _Server(policy)
    try:
        assert instance.call("/usage", token="secret-a")[0] == 404
    finally:
        instance.close()
