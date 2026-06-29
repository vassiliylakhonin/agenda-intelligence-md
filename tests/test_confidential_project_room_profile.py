import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "v1" / "confidential-project-room-profile.schema.json"
EXAMPLE_PATH = ROOT / "profiles" / "confidential-project-room" / "redacted-example.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_redacted_project_room_example_validates_against_schema():
    Draft202012Validator(load_json(SCHEMA_PATH)).validate(load_json(EXAMPLE_PATH))


def test_redacted_project_room_readiness_contract_mirrors_profile_fields():
    example = load_json(EXAMPLE_PATH)
    contract = example["readiness_contract"]

    assert contract["profile"] == "confidential_project_room"
    assert contract["status"] == example["readiness"]["route"]
    assert contract["score"] is None
    assert contract["routing"] == {"field": "readiness.route", "value": example["readiness"]["route"]}
    assert contract["signal"] is None
    assert contract["human_review_required"] is example["readiness"]["human_review_required"]
    assert contract["owner_actions"] == example["owner_actions"]
    assert contract["blocking_gaps"]
    assert contract["claim_audit"]
    assert contract["boundary_notice"]
