from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_mcp_registry_publish_waits_for_pypi_version():
    workflow = (ROOT / ".github/workflows/publish-mcp-registry.yml").read_text()

    availability_gate = workflow.index("Wait for package version on PyPI")
    registry_publish = workflow.index("Publish server to MCP Registry")
    assert availability_gate < registry_publish
    assert "https://pypi.org/pypi/agenda-intelligence-md/${VERSION}/json" in workflow
    assert "for attempt in {1..10}" in workflow


def test_post_release_smoke_exercises_new_verification_surfaces():
    workflow = (ROOT / ".github/workflows/post-release-smoke.yml").read_text()

    assert "grounded-check" in workflow
    assert "verify-claims" in workflow
    assert 'assert "grounded_check" in TOOLS' in workflow
    assert 'assert "verify_claims" in TOOLS' in workflow
