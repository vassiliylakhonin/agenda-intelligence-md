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

    top_level_names = {p.name for p in schema_dir.glob("*.schema.json")}
    packaged_names = {p.name for p in packaged_schema_dir.glob("*.schema.json")}
    assert top_level_names == packaged_names, (
        "schemas/v1 dual-copy diverged: "
        f"top-level only={sorted(top_level_names - packaged_names)}, "
        f"packaged only={sorted(packaged_names - top_level_names)}"
    )
    for name in sorted(top_level_names):
        assert load_json(schema_dir / name) == load_json(packaged_schema_dir / name)


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


def test_packaged_analysis_bank_assets_match_top_level_assets():
    for relative_path in sorted(Path("analysis-bank").rglob("*")):
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


def test_manifest_registers_shipped_vertical_contract_schemas():
    """Every shipped vertical profile must be resolvable from manifest.schemas.

    The manifest is the cold-start contract for agent integrators. If README,
    A2A, HTTP, or MCP advertise a shipped vertical profile, its request and
    response schemas must be discoverable here.
    """
    manifest = load_json(ROOT / "agent-manifest.json")
    schema_paths = {entry["path"] for entry in manifest["schemas"].values()}
    expected = {
        "schemas/v1/middle-corridor-deal-risk-request.schema.json",
        "schemas/v1/middle-corridor-deal-risk-response.schema.json",
        "schemas/v1/cis-secondary-sanctions-request.schema.json",
        "schemas/v1/cis-secondary-sanctions-response.schema.json",
        "schemas/v1/agentic-interaction-trust-request.schema.json",
        "schemas/v1/agentic-interaction-trust-response.schema.json",
        "schemas/v1/gulf-maritime-exposure-request.schema.json",
        "schemas/v1/gulf-maritime-exposure-response.schema.json",
        "schemas/v1/market-entry-readiness-request.schema.json",
        "schemas/v1/market-entry-readiness-response.schema.json",
    }

    missing = sorted(expected - schema_paths)
    assert expected <= schema_paths, f"manifest.schemas missing shipped vertical contracts: {missing}"


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


# ADR 0013 canonical contract-field set. Adding to this set is a compatibility
# surface change and requires a major version bump per ADR 0003.
CANONICAL_CONTRACT_FIELDS = frozenset({"name", "version", "schemas", "mcp", "cli"})


def test_manifest_contract_fields_match_canonical_set():
    """ADR 0013: _contract_fields must equal the canonical set."""
    manifest = load_json(ROOT / "agent-manifest.json")
    contract = set(manifest.get("_contract_fields", []))
    assert contract == CANONICAL_CONTRACT_FIELDS, (
        f"manifest._contract_fields diverged from ADR 0013 canonical set\n"
        f"  expected: {sorted(CANONICAL_CONTRACT_FIELDS)}\n"
        f"  actual:   {sorted(contract)}"
    )


def test_manifest_validates_against_packaged_schema():
    """The manifest must validate against its own JSON Schema. This is the same
    check `agenda-intelligence validate-manifest` performs, lifted into pytest
    so a stale schema fails CI directly.
    """
    from jsonschema import validate

    manifest = load_json(ROOT / "agent-manifest.json")
    schema = load_json(ROOT / "schemas" / "v1" / "agent-manifest.schema.json")
    validate(manifest, schema)


# Cold-start onboarding invariant: an agent given only agent-manifest.json must
# be able to follow every reference it advertises without extra context. ADR
# 0012/0013 already lock the MCP tool surface and schemas[*].path existence;
# these two tests close the remaining references an integrator would resolve:
# the path-like doc/script pointers, and the by-name product schema refs.
def test_manifest_path_references_exist():
    """Every doc/script path the manifest advertises must resolve on disk, so a
    cold integrator following the manifest never hits a dead pointer.
    """
    manifest = load_json(ROOT / "agent-manifest.json")

    path_refs = {}
    for field in ("entrypoint", "adoption", "llms", "eval"):
        value = manifest.get(field)
        if isinstance(value, str):
            path_refs[field] = value
    for i, proto in enumerate(manifest.get("protocols", [])):
        path_refs[f"protocols[{i}]"] = proto

    missing = {ref: p for ref, p in path_refs.items() if not (ROOT / p).is_file()}
    assert not missing, f"manifest advertises path(s) that do not exist: {missing}"


def test_manifest_product_schema_refs_resolve():
    """product.request_schema / response_schema name keys that must exist in the
    manifest.schemas registry, so an agent can resolve the analyze contract.
    """
    manifest = load_json(ROOT / "agent-manifest.json")
    schema_keys = set(manifest.get("schemas", {}))
    product = manifest.get("product", {})

    for field in ("request_schema", "response_schema"):
        ref = product.get(field)
        assert ref in schema_keys, (
            f"product.{field}={ref!r} is not a key in manifest.schemas " f"(known: {sorted(schema_keys)})"
        )
