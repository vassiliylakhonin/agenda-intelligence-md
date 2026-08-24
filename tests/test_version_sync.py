import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def parse_pyproject_version():
    text = (ROOT / "pyproject.toml").read_text()
    match = re.search(r'(?m)^version\s*=\s*"([^"]+)"', text)
    assert match, "pyproject.toml is missing project version"
    return match.group(1)


def parse_dockerfile_version(relative_path):
    text = (ROOT / relative_path).read_text()
    match = re.search(r"(?m)^ARG\s+AGENDA_INTELLIGENCE_VERSION=([^\s]+)", text)
    assert match, f"{relative_path} is missing ARG AGENDA_INTELLIGENCE_VERSION"
    return match.group(1).strip('"')


def parse_worker_version():
    text = (ROOT / "deploy/cloudflare-worker/src/profiles.js").read_text()
    match = re.search(r'(?m)^export const VERSION\s*=\s*"([^"]+)";', text)
    assert match, "Cloudflare Worker source is missing VERSION"
    return match.group(1)


def collect_json_versions(path):
    if not path.exists():
        return []

    data = json.loads(path.read_text())
    versions = []
    if "version" in data:
        versions.append((f"{path.name}:version", data["version"]))
    if isinstance(data.get("serverInfo"), dict) and "version" in data["serverInfo"]:
        versions.append((f"{path.name}:serverInfo.version", data["serverInfo"]["version"]))
    if isinstance(data.get("info"), dict) and "version" in data["info"]:
        versions.append((f"{path.name}:info.version", data["info"]["version"]))
    if isinstance(data.get("metadata"), dict) and "version" in data["metadata"]:
        versions.append((f"{path.name}:metadata.version", data["metadata"]["version"]))

    for index, package in enumerate(data.get("packages", [])):
        if isinstance(package, dict) and "version" in package:
            versions.append((f"{path.name}:packages[{index}].version", package["version"]))

    return versions


def test_release_version_fields_match_pyproject():
    expected = parse_pyproject_version()
    discovered = [
        ("Dockerfile:ARG AGENDA_INTELLIGENCE_VERSION", parse_dockerfile_version("Dockerfile")),
        ("Dockerfile.api:ARG AGENDA_INTELLIGENCE_VERSION", parse_dockerfile_version("Dockerfile.api")),
        ("Dockerfile.a2a:ARG AGENDA_INTELLIGENCE_VERSION", parse_dockerfile_version("Dockerfile.a2a")),
        ("deploy/cloudflare-worker/src/profiles.js:VERSION", parse_worker_version()),
    ]

    for relative_path in [
        "agent-manifest.json",
        "src/agenda_intelligence/data/agent-manifest.json",
        "server.json",
        ".claude-plugin/plugin.json",
        ".claude-plugin/marketplace.json",
        ".codex-plugin/plugin.json",
        ".well-known/agent-card.json",
        ".well-known/ai-catalog.json",
        ".well-known/did.json",
        ".well-known/mcp-server.json",
        ".well-known/mcp/server-card.json",
        "api/openapi.json",
    ]:
        discovered.extend(collect_json_versions(ROOT / relative_path))

    mismatches = [f"{name}={version!r} expected {expected!r}" for name, version in discovered if version != expected]
    assert not mismatches, "Version drift detected: " + "; ".join(mismatches)


def test_public_plugin_metadata_avoids_unsupported_grade_claims():
    public_metadata = [
        ".claude-plugin/marketplace.json",
        ".claude-plugin/plugin.json",
        ".codex-plugin/plugin.json",
        "plugin.json",
        "mcp.json",
        "server.json",
    ]
    forbidden = ("decision-grade", "production-grade", "enterprise-grade")
    hits = []

    for relative_path in public_metadata:
        text = (ROOT / relative_path).read_text().lower()
        hits.extend(f"{relative_path}: {phrase}" for phrase in forbidden if phrase in text)

    assert not hits, "Unsupported grade claim in public plugin metadata: " + "; ".join(hits)
