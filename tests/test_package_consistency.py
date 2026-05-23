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
