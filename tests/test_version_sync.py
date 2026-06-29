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


def collect_json_versions(path):
    if not path.exists():
        return []

    data = json.loads(path.read_text())
    versions = []
    if "version" in data:
        versions.append((f"{path.name}:version", data["version"]))
    if isinstance(data.get("serverInfo"), dict) and "version" in data["serverInfo"]:
        versions.append((f"{path.name}:serverInfo.version", data["serverInfo"]["version"]))

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
    ]

    for relative_path in [
        "agent-manifest.json",
        "src/agenda_intelligence/data/agent-manifest.json",
        "server.json",
        ".well-known/agent-card.json",
        ".well-known/ai-catalog.json",
        ".well-known/did.json",
        ".well-known/mcp-server.json",
        ".well-known/mcp/server-card.json",
    ]:
        discovered.extend(collect_json_versions(ROOT / relative_path))

    mismatches = [f"{name}={version!r} expected {expected!r}" for name, version in discovered if version != expected]
    assert not mismatches, "Version drift detected: " + "; ".join(mismatches)
