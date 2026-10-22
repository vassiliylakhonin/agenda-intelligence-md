"""Tests for the guarded manual sanctions-index publisher."""

from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import subprocess
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "publish_sanctions_index.py"
SPEC = importlib.util.spec_from_file_location("publish_sanctions_index", SCRIPT)
assert SPEC and SPEC.loader
PUBLISH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PUBLISH)


@pytest.fixture(autouse=True)
def isolate_publisher_credentials(monkeypatch):
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)


def completed(command: list[str], returncode: int = 0, stdout: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(command, returncode, stdout=stdout, stderr="")


@pytest.fixture
def staged_worker(monkeypatch):
    monkeypatch.setattr(PUBLISH, "prepare_worker_publish", lambda _digest: None)
    monkeypatch.setenv("CLOUDFLARE_WORKER_API_TOKEN", "synthetic-worker-token")
    monkeypatch.setenv("VIZIER_DEPLOY_GRANT_FILE", "/synthetic/grant")


def test_prepare_candidate_runs_build_shape_and_drift_gates_in_order(monkeypatch, tmp_path):
    compact = tmp_path / "compact.json"
    compact.write_bytes(b"candidate\n")
    commands: list[list[str]] = []

    def fake_run(command, **_kwargs):
        commands.append(list(command))
        return completed(list(command))

    monkeypatch.setattr(PUBLISH, "ROOT", tmp_path)
    monkeypatch.setattr(PUBLISH, "COMPACT_INDEX", compact)
    monkeypatch.setattr(PUBLISH, "run_command", fake_run)

    digest = PUBLISH.prepare_candidate()

    assert commands[0][1] == "scripts/sanctions_name_index.py"
    assert commands[1][1] == "scripts/verify_sanctions_index.py"
    assert commands[2][1] == "scripts/gate_sanctions_index_publish.py"
    assert digest == hashlib.sha256(b"candidate\n").hexdigest()


@pytest.mark.parametrize(
    ("branch", "dirty", "message"),
    [("feature", "", "expected 'main'"), ("main", " M scripts/example.py", "source changes are present")],
)
def test_publish_requires_a_clean_main_checkout(monkeypatch, branch, dirty, message):
    responses = iter([branch, dirty])

    def fake_run(command, **_kwargs):
        return completed(list(command), stdout=next(responses))

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)

    with pytest.raises(RuntimeError, match=message):
        PUBLISH.require_clean_main()


def test_publish_uses_pages_and_gated_worker_before_exact_byte_check(monkeypatch, staged_worker):
    commands: list[list[str]] = []

    def fake_run(command, **kwargs):
        command = list(command)
        commands.append(command)
        stdout = json.dumps({"accounts": [{"id": "test-account"}]}) if "whoami" in command else ""
        return completed(command, returncode=0, stdout=stdout)

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)
    monkeypatch.setattr(PUBLISH, "POST_DEPLOY_PAUSE_SECONDS", 0)

    PUBLISH.publish_candidate("a" * 64)

    assert commands[0] == ["npx", "--yes", "wrangler@4.122.0", "--version"]
    assert commands[1] == ["npx", "--yes", "wrangler@4.122.0", "whoami", "--json"]
    assert commands[2][0:5] == ["npx", "--yes", "wrangler@4.122.0", "pages", "deploy"]
    assert "--project-name=sanctions-name-index" in commands[2]
    assert commands[3] == ["node", "scripts/vizier-gated-deploy.js", "--env", "cis-secondary-sanctions"]
    assert "--expected-sha256" in commands[4]
    assert "--default-urllib" in commands[4]
    assert commands[4][-1] == "a" * 64


def test_publish_fails_when_canonical_url_never_serves_candidate(monkeypatch, staged_worker):
    calls = 0

    def fake_run(command, **kwargs):
        nonlocal calls
        calls += 1
        command = list(command)
        if "whoami" in command:
            return completed(command, stdout=json.dumps({"accounts": [{"id": "test-account"}]}))
        if any(item.endswith("check_published_index.py") for item in command):
            return completed(command, returncode=1)
        return completed(command)

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)
    monkeypatch.setattr(PUBLISH, "POST_DEPLOY_ATTEMPTS", 2)
    monkeypatch.setattr(PUBLISH, "POST_DEPLOY_PAUSE_SECONDS", 0)

    with pytest.raises(RuntimeError, match="never served the exact gated artifact"):
        PUBLISH.publish_candidate("b" * 64)

    assert calls == 6


def test_publish_rejects_ambiguous_wrangler_account(monkeypatch):
    def fake_run(command, **kwargs):
        command = list(command)
        stdout = json.dumps({"accounts": [{"id": "one"}, {"id": "two"}]}) if "whoami" in command else ""
        return completed(command, stdout=stdout)

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)

    with pytest.raises(RuntimeError, match="exactly one Cloudflare account; found 2"):
        PUBLISH.verify_wrangler_auth()


def test_manual_publisher_uses_the_worker_fleets_pinned_wrangler_version():
    deploy_script = (ROOT / "deploy/cloudflare-worker/scripts/vizier-gated-deploy.js").read_text()

    assert f'const WRANGLER_VERSION = "{PUBLISH.WRANGLER_VERSION}"' in deploy_script


def test_pages_token_auth_checks_the_fixed_project_without_user_or_membership_permissions(monkeypatch):
    calls = []
    commands = []
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "synthetic-pages-token")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "a" * 32)

    def fake_run(command, **kwargs):
        commands.append(list(command))
        return completed(list(command))

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)

    class Response(io.BytesIO):
        status = 200

    class Opener:
        def open(self, request, timeout):
            assert timeout == 30
            calls.append(request)
            return Response(
                json.dumps(
                    {
                        "success": True,
                        "result": {"name": "sanctions-name-index", "subdomain": "sanctions-name-index.pages.dev"},
                    }
                ).encode()
            )

    monkeypatch.setattr(PUBLISH, "pages_auth_opener", lambda: Opener())
    PUBLISH.verify_wrangler_auth()
    assert commands == [["npx", "--yes", "wrangler@4.122.0", "--version"]]
    assert len(calls) == 1
    assert (
        calls[0].full_url
        == "https://api.cloudflare.com/client/v4/accounts/" + "a" * 32 + "/pages/projects/sanctions-name-index"
    )
    assert calls[0].get_header("Authorization") == "Bearer synthetic-pages-token"


@pytest.mark.parametrize("account", [None, "", "a/b", "a" * 31, "g" * 32])
def test_pages_auth_requires_an_explicit_account_and_never_falls_back(monkeypatch, account):
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "synthetic-pages-token")
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    if account is not None:
        monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", account)
    monkeypatch.setattr(PUBLISH, "run_command", lambda command, **kwargs: completed(list(command)))
    with pytest.raises(RuntimeError, match="explicit Cloudflare account"):
        PUBLISH.verify_wrangler_auth()


@pytest.mark.parametrize("token", ["", "contains whitespace\n"])
def test_pages_auth_rejects_empty_or_malformed_token(monkeypatch, token):
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", token)
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "a" * 32)
    monkeypatch.setattr(PUBLISH, "run_command", lambda command, **kwargs: completed(list(command)))
    with pytest.raises(RuntimeError, match="empty or malformed"):
        PUBLISH.verify_wrangler_auth()


@pytest.mark.parametrize(
    "body",
    [
        b"not-json",
        b"\xff",
        b"x" * 65537,
        b"[]",
        b'{"success":false,"result":{"name":"sanctions-name-index"}}',
        b'{"success":true,"result":{"name":"other","subdomain":"sanctions-name-index.pages.dev"}}',
        b'{"success":true,"result":{"name":"sanctions-name-index","subdomain":"other.pages.dev"}}',
    ],
)
def test_pages_auth_rejects_invalid_or_wrong_project_metadata_before_deploy(monkeypatch, body):
    commands = []
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "synthetic-pages-token")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "a" * 32)

    def fake_run(command, **kwargs):
        commands.append(list(command))
        return completed(list(command))

    class Response(io.BytesIO):
        status = 200

        def read(self, limit):
            assert limit == 65537
            return super().read(limit)

    class Opener:
        def open(self, request, timeout):
            return Response(body)

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)
    monkeypatch.setattr(PUBLISH, "pages_auth_opener", lambda: Opener())
    with pytest.raises(RuntimeError):
        PUBLISH.publish_candidate("a" * 64)
    assert commands == [["npx", "--yes", "wrangler@4.122.0", "--version"]]


@pytest.mark.parametrize("status", [301, 401, 403])
def test_pages_auth_refusal_stops_without_retry_fallback_or_secret_logging(monkeypatch, capsys, status):
    commands = []
    requests = []
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "synthetic-pages-token")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "a" * 32)

    def fake_run(command, **kwargs):
        commands.append(list(command))
        return completed(list(command))

    class Opener:
        def open(self, request, timeout):
            requests.append(request)
            raise urllib.error.HTTPError(
                request.full_url, status, "synthetic-pages-token", {}, io.BytesIO(b"private-response")
            )

    monkeypatch.setattr(PUBLISH, "run_command", fake_run)
    monkeypatch.setattr(PUBLISH, "pages_auth_opener", lambda: Opener())
    with pytest.raises(RuntimeError, match=f"HTTP {status}") as error:
        PUBLISH.publish_candidate("a" * 64)
    output = str(error.value) + str(capsys.readouterr())
    assert "synthetic-pages-token" not in output
    assert "private-response" not in output
    assert len(requests) == 1
    assert commands == [["npx", "--yes", "wrangler@4.122.0", "--version"]]


def test_pages_auth_opener_refuses_redirects():
    opener = PUBLISH.pages_auth_opener()
    handlers = [handler for handler in opener.handlers if isinstance(handler, urllib.request.HTTPRedirectHandler)]
    assert len(handlers) == 1
    assert handlers[0].redirect_request(None, None, 302, "redirect", {}, "https://other.example") is None


def test_publisher_stops_on_canonical_access_refusal_without_retry(monkeypatch, staged_worker):
    commands = []

    def fake_run(command, **kwargs):
        command = list(command)
        commands.append(command)
        if any(item.endswith("check_published_index.py") for item in command):
            return completed(command, returncode=2)
        return completed(command)

    monkeypatch.setattr(PUBLISH, "verify_wrangler_auth", lambda: None)
    monkeypatch.setattr(PUBLISH, "run_command", fake_run)
    monkeypatch.setattr(PUBLISH.time, "sleep", lambda _: pytest.fail("Access refusal must not be retried"))
    with pytest.raises(RuntimeError, match="access refused"):
        PUBLISH.publish_candidate("a" * 64)
    assert len(commands) == 3


def test_runtime_publisher_and_watchdog_use_one_canonical_snapshot_url():
    config = tomllib.loads((ROOT / "deploy/cloudflare-worker/wrangler.toml").read_text())
    runtime = config["env"]["cis-secondary-sanctions"]["vars"]["SNAPSHOT_INDEX_URL"]
    workflow = (ROOT / ".github/workflows/check-sanctions-index.yml").read_text()
    assert runtime == PUBLISH.PUBLISHED_URL
    assert workflow.count("--published " + PUBLISH.PUBLISHED_URL) == 2
    assert workflow.count("--default-urllib") == 2


def test_missing_worker_authority_stops_before_either_publication(monkeypatch):
    monkeypatch.delenv("CLOUDFLARE_WORKER_API_TOKEN", raising=False)
    monkeypatch.setattr(PUBLISH, "verify_wrangler_auth", lambda: None)
    monkeypatch.setattr(
        PUBLISH, "run_command", lambda *a, **k: pytest.fail("no upload before all authority is present")
    )
    with pytest.raises(RuntimeError, match="separate existing Worker credential"):
        PUBLISH.publish_candidate("a" * 64)


def test_worker_deploy_uses_only_its_separate_credential_and_existing_gate(monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "synthetic-pages-token")
    monkeypatch.setenv("CLOUDFLARE_WORKER_API_TOKEN", "synthetic-worker-token")
    calls = []
    monkeypatch.setattr(PUBLISH, "run_command", lambda command, **kwargs: calls.append((command, kwargs)))
    PUBLISH.deploy_worker_candidate()
    command, options = calls[0]
    assert command == ["node", "scripts/vizier-gated-deploy.js", "--env", "cis-secondary-sanctions"]
    assert options["env"]["CLOUDFLARE_API_TOKEN"] == "synthetic-worker-token"
    assert "CLOUDFLARE_WORKER_API_TOKEN" not in options["env"]
    assert options["cwd"] == ROOT / "deploy/cloudflare-worker"
