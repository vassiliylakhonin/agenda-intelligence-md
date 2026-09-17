"""Unit tests for x402 micropayments protocol definitions."""

from __future__ import annotations

from pathlib import Path


def test_discovery_x402_json_contains_micropayments() -> None:
    discovery_file = Path("deploy/cloudflare-worker/src/discovery_text.js")
    content = discovery_file.read_text(encoding="utf-8")

    assert "tier_micro_check" in content
    assert "tier_micro_dispute" in content
    assert "0.05" in content
    assert "0.50" in content


def test_profiles_micropayment_constants() -> None:
    profiles_file = Path("deploy/cloudflare-worker/src/profiles.js")
    content = profiles_file.read_text(encoding="utf-8")

    assert "TIER_MICRO_CHECK_USDC_AMOUNT = 0.05" in content
    assert "TIER_MICRO_DISPUTE_USDC_AMOUNT = 0.50" in content


def test_settlement_x402_helper_present() -> None:
    settlement_file = Path("deploy/cloudflare-worker/src/settlement.js")
    content = settlement_file.read_text(encoding="utf-8")

    assert "generateX402PaymentResponse" in content
    assert "WWW-Authenticate" in content or "www-authenticate" in content
    assert "tier_micro_check" in content
    assert "tier_micro_dispute" in content
