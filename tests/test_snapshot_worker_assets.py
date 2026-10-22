"""Asset publication must reject stale, substituted and overbroad uploads."""

from __future__ import annotations

import hashlib
import json
import runpy
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def staging(monkeypatch, tmp_path):
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    namespace = runpy.run_path(str(ROOT / "scripts" / "snapshot_worker_assets.py"))
    stage = namespace["stage_bytes"]
    stage.__globals__["ASSETS"] = tmp_path / "assets"
    return stage, tmp_path / "assets"


def candidate(*, age=timedelta(hours=1), canaries=True):
    entries = [["EXAMPLE NAME", 0] for _ in range(60_000)]
    if canaries:
        entries[:2] = [["SBERBANK OF RUSSIA", 0], ["GAZPROM NEFT", 0]]
    return json.dumps(
        {
            "schema_version": "sanctions-name-index-compact.v1",
            "generated_at_utc": (datetime.now(timezone.utc) - age).isoformat(),
            "summary": {"source_count": 4, "name_count": len(entries)},
            "entries": entries,
        }
    ).encode()


def test_validated_asset_preserves_exact_raw_bytes(staging):
    stage, assets = staging
    raw = candidate()
    digest = hashlib.sha256(raw).hexdigest()
    assert stage(raw, expected_sha256=digest) == digest
    assert [p.name for p in assets.iterdir()] == ["sanctions-name-index-compact.json"]
    assert (assets / "sanctions-name-index-compact.json").read_bytes() == raw


@pytest.mark.parametrize("age", [timedelta(days=4), timedelta(hours=-1)])
def test_outdated_or_future_asset_is_never_staged(staging, age):
    stage, assets = staging
    with pytest.raises(RuntimeError, match="stale, undated or in the future"):
        stage(candidate(age=age))
    assert not assets.exists()


def test_substituted_bootstrap_or_candidate_is_rejected_before_writing(staging):
    stage, assets = staging
    with pytest.raises(RuntimeError, match="exact SHA-256"):
        stage(candidate(), expected_sha256="0" * 64)
    assert not assets.exists()


def test_source_canary_failure_prevents_upload(staging):
    stage, assets = staging
    with pytest.raises(subprocess.CalledProcessError):
        stage(candidate(canaries=False))
    assert list(assets.iterdir()) == []


def test_extra_file_or_symlink_prevents_asset_upload(staging, tmp_path):
    stage, assets = staging
    assets.mkdir()
    secret = tmp_path / "private.txt"
    secret.write_text("synthetic private fixture")
    (assets / ".env").symlink_to(secret)
    with pytest.raises(RuntimeError, match="only the compact JSON"):
        stage(candidate())
    assert not (assets / "sanctions-name-index-compact.json").exists()
