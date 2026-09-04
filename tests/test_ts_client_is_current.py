"""The checked-in TypeScript client must match the schemas it was generated from.

A partner integrates against the client, not the schema files. If the two can
drift, the contract policy in ADR 0003 stops meaning anything on the client
side, so the generator is the source of truth and this test is the gate.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.generate_ts_client import ENDPOINTS, OUT, Emitter, render

ROOT = Path(__file__).resolve().parents[1]


def test_checked_in_client_matches_the_schemas():
    stale = [
        relative
        for relative, content in render().items()
        if not (OUT / relative).exists() or (OUT / relative).read_text(encoding="utf-8") != content
    ]
    assert not stale, "run `python3 scripts/generate_ts_client.py`; stale: " + ", ".join(sorted(stale))


def test_every_endpoint_row_names_schemas_that_exist():
    for _method, _verb, path, request_stem, response_stem, _summary in ENDPOINTS:
        for stem in (request_stem, response_stem):
            if stem is None:
                continue
            assert (ROOT / "schemas" / "v1" / f"{stem}.schema.json").exists(), f"{path} names a missing schema {stem}"


def test_the_client_covers_every_post_endpoint_the_shell_serves():
    source = (ROOT / "src" / "agenda_intelligence" / "http_api.py").read_text(encoding="utf-8")
    served = {line.split('"')[1] for line in source.splitlines() if line.strip().startswith('if path == "/v1/')}
    covered = {row[2] for row in ENDPOINTS}
    assert (
        served == covered
    ), f"client and shell disagree: only in the shell {served - covered}, only in the client {covered - served}"


def test_client_version_tracks_the_package():
    package = json.loads((OUT / "package.json").read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / "agent-manifest.json").read_text(encoding="utf-8"))
    assert package["version"] == manifest["version"]


def test_the_generator_refuses_to_guess_at_an_unsupported_schema(tmp_path):
    emitter = Emitter()
    emitter._defs = {}
    emitter._root = "X"
    with pytest.raises(Exception):
        emitter._type({"type": "array"}, "X")  # array without items
