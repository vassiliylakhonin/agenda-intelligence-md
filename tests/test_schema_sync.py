"""Guard that top-level schemas/v1/ and the packaged data/schemas/v1/ stay byte-equal.

The package ships its schemas under src/agenda_intelligence/data/schemas/v1/ so
they are available to wheel installs. The repo also keeps a top-level
schemas/v1/ directory for human discoverability and external tooling. These
must not drift; new schemas must land in both.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOP_LEVEL = ROOT / "schemas" / "v1"
PACKAGED = ROOT / "src" / "agenda_intelligence" / "data" / "schemas" / "v1"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_every_top_level_schema_is_packaged():
    missing = []
    for path in sorted(TOP_LEVEL.glob("*.schema.json")):
        if not (PACKAGED / path.name).is_file():
            missing.append(path.name)
    assert not missing, f"top-level schemas missing from packaged data: {missing}"


@pytest.mark.parametrize(
    "name",
    [p.name for p in sorted(Path(TOP_LEVEL).glob("*.schema.json"))],
)
def test_schema_byte_equal(name: str):
    top = _read(TOP_LEVEL / name)
    pkg = _read(PACKAGED / name)
    assert json.loads(top) == json.loads(
        pkg
    ), f"schemas/v1/{name} and src/agenda_intelligence/data/schemas/v1/{name} diverged"
