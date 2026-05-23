import json
import re
from pathlib import Path

import agenda_intelligence

ROOT = Path(__file__).resolve().parents[1]


def load_json(path):
    return json.loads(path.read_text())


def test_manifest_versions_match_package_version():
    pyproject = (ROOT / "pyproject.toml").read_text()
    version_line = next(line for line in pyproject.splitlines() if line.startswith("version = "))
    package_version = version_line.split('"')[1]

    top_level_manifest = load_json(ROOT / "agent-manifest.json")
    packaged_manifest = load_json(ROOT / "src/agenda_intelligence/data/agent-manifest.json")

    assert top_level_manifest["version"] == package_version
    assert packaged_manifest["version"] == package_version
    assert packaged_manifest == top_level_manifest
    assert agenda_intelligence.__version__ == package_version


def test_release_download_snippet_matches_package_version():
    pyproject = (ROOT / "pyproject.toml").read_text()
    version_line = next(line for line in pyproject.splitlines() if line.startswith("version = "))
    package_version = version_line.split('"')[1]
    readme = (ROOT / "README.md").read_text()

    expected = f"releases/download/v{package_version}/agenda_intelligence_md-{package_version}-py3-none-any.whl"
    assert expected in readme
    assert not re.search(r"releases/download/v(?!%s/)" % re.escape(package_version), readme)


def test_packaged_schemas_match_top_level_schemas():
    schema_dir = ROOT / "schemas" / "v1"
    packaged_schema_dir = ROOT / "src/agenda_intelligence/data/schemas/v1"

    for schema_path in sorted(schema_dir.glob("*.schema.json")):
        packaged_schema_path = packaged_schema_dir / schema_path.name
        assert packaged_schema_path.exists(), f"Missing packaged schema: {schema_path.name}"
        assert load_json(packaged_schema_path) == load_json(schema_path)


def assert_packaged_copy_matches_top_level(relative_path):
    top_level = ROOT / relative_path
    packaged = ROOT / "src/agenda_intelligence/data" / relative_path

    assert top_level.exists(), f"Missing top-level asset: {relative_path}"
    assert packaged.exists(), f"Missing packaged asset: {relative_path}"
    assert packaged.read_bytes() == top_level.read_bytes(), f"Packaged asset drifted: {relative_path}"


def test_packaged_text_assets_match_top_level_assets():
    for relative_path in [
        "Agenda-Intelligence.md",
        "SOURCE_POLICY.md",
        "llms.txt",
    ]:
        assert_packaged_copy_matches_top_level(relative_path)


def test_packaged_json_assets_match_top_level_assets():
    for relative_path in [
        "agent-manifest.json",
        "source-taxonomy.json",
    ]:
        assert_packaged_copy_matches_top_level(relative_path)

    for relative_path in sorted(Path("source-requirements").glob("*.json")):
        assert_packaged_copy_matches_top_level(relative_path)


def test_packaged_skill_assets_match_top_level_assets():
    for relative_path in sorted(Path("skills/agenda-intelligence").rglob("*")):
        if relative_path.is_file():
            assert_packaged_copy_matches_top_level(relative_path)


# ADR 0012 + ADR 0013: manifest is the authoritative MCP and schema registry.


def test_manifest_mcp_tools_match_code():
    """ADR 0012: manifest.mcp.tools must mirror the TOOLS dict in mcp_stdio.py.

    Names, ordering, and input_schema content must match exactly.
    """
    from agenda_intelligence.mcp_stdio import TOOLS

    manifest = load_json(ROOT / "agent-manifest.json")
    mcp = manifest.get("mcp")
    assert isinstance(mcp, dict), "manifest.mcp missing or wrong type"
    tools = mcp.get("tools")
    assert isinstance(tools, list), "manifest.mcp.tools missing or wrong type"

    manifest_names = [t["name"] for t in tools]
    code_names = list(TOOLS.keys())
    assert manifest_names == code_names, (
        f"manifest.mcp.tools name list diverged from TOOLS dict\n"
        f"  manifest: {manifest_names}\n"
        f"  code:     {code_names}"
    )

    for entry in tools:
        name = entry["name"]
        code_schema = TOOLS[name]["inputSchema"]
        manifest_schema = entry.get("input_schema")
        assert manifest_schema == code_schema, (
            f"manifest.mcp.tools[{name}].input_schema diverged from " f"TOOLS[{name}]['inputSchema']"
        )


def test_manifest_schemas_paths_exist_and_match_schema_version():
    """ADR 0013: every schemas entry must point at an existing v1 file."""
    manifest = load_json(ROOT / "agent-manifest.json")
    schemas = manifest.get("schemas")
    assert isinstance(schemas, dict), "manifest.schemas missing"

    for key, entry in schemas.items():
        assert isinstance(entry, dict), f"schemas[{key}] must be object, got {type(entry).__name__}"
        assert "path" in entry and "schema_version" in entry, f"schemas[{key}] missing path/schema_version"
        path = ROOT / entry["path"]
        assert path.is_file(), f"schemas[{key}].path does not exist: {entry['path']}"
        # The /vN/ path segment must match the declared schema_version
        assert (
            f"/{entry['schema_version']}/" in entry["path"]
        ), f"schemas[{key}] schema_version={entry['schema_version']!r} does not match path={entry['path']!r}"


def test_manifest_contract_and_informational_fields_cover_top_level_keys():
    """ADR 0013: _contract_fields and _informational_fields together must cover
    every top-level manifest key except themselves.
    """
    manifest = load_json(ROOT / "agent-manifest.json")
    contract = set(manifest.get("_contract_fields", []))
    informational = set(manifest.get("_informational_fields", []))
    declared = contract | informational
    actual = set(manifest.keys()) - {"_contract_fields", "_informational_fields"}

    missing = actual - declared
    extra = declared - actual
    assert not missing, f"manifest fields not declared as contract or informational: {sorted(missing)}"
    assert not extra, f"declared fields not present in manifest: {sorted(extra)}"
    assert not (
        contract & informational
    ), f"fields cannot be both contract and informational: {sorted(contract & informational)}"
