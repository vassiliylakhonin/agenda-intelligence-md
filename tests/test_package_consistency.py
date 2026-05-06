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
    schema_dir = ROOT / "schemas"
    packaged_schema_dir = ROOT / "src/agenda_intelligence/data/schemas"

    for schema_path in sorted(schema_dir.glob("*.schema.json")):
        packaged_schema_path = packaged_schema_dir / schema_path.name
        assert packaged_schema_path.exists(), f"Missing packaged schema: {schema_path.name}"
        assert load_json(packaged_schema_path) == load_json(schema_path)
