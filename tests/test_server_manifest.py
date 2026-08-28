"""Guard the MCP registry manifest against the two ways it can lie.

``server.json`` is what the registry publishes on release, and until 2026-08-28
it declared one way to reach this project: install the PyPI package and speak
stdio. The ten hosted Streamable HTTP endpoints -- live, open, answering
``tools/list`` with complete input and output schemas -- were not in it, so an
agent browsing the registry saw software to install rather than endpoints it
could call. Observed the same day: 4-5 listing impressions per gate in the
Agenstry directory and zero invocations.

Declaring them is only useful while the declaration stays true, and it can stop
being true in two directions: a URL here that no deployment serves, and a
deployment that ships without ever being declared. Both are checked offline,
against ``wrangler.toml``, because the deployment file is the only thing that
cannot disagree with what is live.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "server.json"
WRANGLER = ROOT / "deploy" / "cloudflare-worker" / "wrangler.toml"
WORKERS_SUBDOMAIN = "vassiliy-lakhonin.workers.dev"


def declared_worker_names() -> set[str]:
    """Every Worker name wrangler.toml publishes, top-level and per environment."""
    names: set[str] = set()
    for line in WRANGLER.read_text(encoding="utf-8").splitlines():
        match = re.match(r'^name\s*=\s*"([^"]+)"', line.strip())
        if match:
            names.add(match.group(1))
    return names


def remotes() -> list[dict]:
    return json.loads(MANIFEST.read_text(encoding="utf-8")).get("remotes", [])


def test_every_hosted_endpoint_is_declared() -> None:
    declared = {
        remote["url"].removeprefix("https://").removesuffix("/mcp").removesuffix(f".{WORKERS_SUBDOMAIN}")
        for remote in remotes()
    }
    missing = sorted(declared_worker_names() - declared)
    assert not missing, (
        "wrangler.toml deploys Workers the registry manifest does not mention, "
        "so they are invisible to anyone browsing the registry: " + ", ".join(missing)
    )


def test_no_declared_endpoint_is_invented() -> None:
    names = declared_worker_names()
    unknown = []
    for remote in remotes():
        url = remote["url"]
        assert url.startswith("https://"), f"{url} is not https"
        assert url.endswith("/mcp"), f"{url} does not point at the MCP endpoint"
        host = url.removeprefix("https://").removesuffix("/mcp")
        assert host.endswith(f".{WORKERS_SUBDOMAIN}"), f"{url} is not a Worker of this fleet"
        if host.removesuffix(f".{WORKERS_SUBDOMAIN}") not in names:
            unknown.append(url)

    assert not unknown, "the manifest points the registry at endpoints no deployment serves: " + ", ".join(unknown)


def test_remotes_are_streamable_http_and_unique() -> None:
    listed = remotes()
    assert listed, "server.json declares no hosted endpoint"

    # Anything but streamable-http would be a claim about a transport the
    # Workers do not implement: /mcp speaks MCP 2026-07-28, which removed
    # sessions and stream resumability (ADR 0024).
    wrong = [remote for remote in listed if remote.get("type") != "streamable-http"]
    assert not wrong, f"non-streamable-http transports declared: {wrong}"

    urls = [remote["url"] for remote in listed]
    assert len(urls) == len(set(urls)), "the same endpoint is declared twice"

    # The general profile comes first: it is the deployment whose scope matches
    # this entry's description, and a client that takes the first remote without
    # reading further should land there rather than on a vertical gate.
    assert urls[0] == f"https://agenda-intelligence-a2a.{WORKERS_SUBDOMAIN}/mcp"
