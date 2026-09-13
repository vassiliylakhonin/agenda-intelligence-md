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


def test_sanctions_watchdog_treats_a_fresh_source_outage_as_a_warning():
    workflow = (ROOT / ".github/workflows/check-sanctions-index.yml").read_text()

    published_check = workflow.index("Check the published index is healthy")
    rebuild = workflow.index("Rebuild the index from the official sources")
    assert published_check < rebuild
    assert "id: rebuild" in workflow
    assert "continue-on-error: true" in workflow
    assert "if: steps.rebuild.outcome == 'failure'" in workflow
    assert workflow.count("if: steps.rebuild.outcome == 'success'") == 2
    assert 'cron: "20 5 * * *"' in workflow


def test_sanctions_watchdog_preserves_a_recovery_artifact_before_failing_stale_publication():
    workflow = (ROOT / ".github/workflows/check-sanctions-index.yml").read_text()

    published_check = workflow.index("Check the published index is healthy")
    recovery_artifact = workflow.index("Preserve the rebuilt index for recovery")
    enforce_health = workflow.index("Enforce published-index health after recovery build")
    assert published_check < recovery_artifact < enforce_health
    assert "id: published" in workflow
    assert "actions/upload-artifact@v7" in workflow
    assert "sanctions-name-index-${{ github.run_id }}" in workflow
    assert "if: always() && steps.published.outcome == 'failure'" in workflow


def test_sanctions_refresh_gates_before_credentialed_deploy_and_checks_exact_bytes():
    workflow = (ROOT / ".github/workflows/refresh-sanctions-index.yml").read_text()

    source_build = workflow.index("Build from every official source")
    shape_gate = workflow.index("Refuse a candidate that lost its shape or canaries")
    drift_gate = workflow.index("Refuse an anomalous change against production")
    artifact = workflow.index("Preserve the rebuilt candidate")
    deploy_job = workflow.index("name: Publish gated candidate")
    deploy = workflow.index("Publish to the dedicated Cloudflare Pages project")
    post_deploy = workflow.index("Confirm production serves the exact candidate")
    assert source_build < shape_gate < drift_gate < artifact < deploy_job < deploy < post_deploy
    assert "environment:\n      name: sanctions-index-production" in workflow
    assert "secrets.CLOUDFLARE_PAGES_API_TOKEN" in workflow
    assert "secrets.CLOUDFLARE_ACCOUNT_ID" in workflow
    assert "wrangler@4.122.0 pages deploy" in workflow
    assert "--expected-sha256" in workflow
    assert "if: always() && steps.source_build.outcome == 'success'" in workflow


def test_sanctions_refresh_requires_explicit_publish_or_enabled_schedule():
    workflow = (ROOT / ".github/workflows/refresh-sanctions-index.yml").read_text()

    assert "default: false" in workflow
    assert "vars.SANCTIONS_INDEX_AUTOPUBLISH_ENABLED == 'true'" in workflow
    assert "github.event_name == 'workflow_dispatch' && inputs.publish == true" in workflow
    assert 'cron: "20 4 * * *"' in workflow
