"""Contract tests for the Kazakhstan market-entry readiness gate.

This worker is contract-only (schema + source-requirements + use-case + example);
it has no service function yet, so these tests guard the static contract: the
example and the inline use-case examples must validate against the schemas, the
source taxonomy must stay a subset of the request source_type enum, and the
dual-copy under src/agenda_intelligence/data/ must stay byte-identical.
"""

import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
REQUEST_SCHEMA_PATH = ROOT / "schemas" / "v1" / "market-entry-readiness-request.schema.json"
RESPONSE_SCHEMA_PATH = ROOT / "schemas" / "v1" / "market-entry-readiness-response.schema.json"
TAXONOMY_PATH = ROOT / "source-requirements" / "kazakhstan-market-entry-readiness.json"
USE_CASE_PATH = ROOT / "docs" / "use-cases" / "kazakhstan-market-entry-readiness.md"
EXAMPLE_DIR = ROOT / "examples" / "kazakhstan-market-entry-readiness" / "contract"
DATA_DIR = ROOT / "src" / "agenda_intelligence" / "data"

# Discovery-pain additions (2026-06-09): cross-sector regulatory-setup evidence
# that the original mobility-leaning taxonomy did not cover.
REGULATORY_SETUP_TYPES = {
    "permanent_establishment_or_tax_residency_assessment",
    "currency_control_and_repatriation_note",
    "work_permit_and_local_employment_quota_note",
    "local_content_or_procurement_localization_note",
    "special_economic_zone_eligibility_note",
}

# Discovery-pain additions (2026-06-10): intangible-asset / data protection a
# brand-heavy entrant typically misses (trademark squatting, data localization).
IP_AND_DATA_TYPES = {
    "trademark_or_brand_protection_filing",
    "data_localization_and_privacy_note",
}


def load_json(path: Path):
    return json.loads(path.read_text())


def request_enum() -> set[str]:
    schema = load_json(REQUEST_SCHEMA_PATH)
    return set(schema["$defs"]["source_type"]["enum"])


def test_example_request_validates_against_schema():
    Draft202012Validator(load_json(REQUEST_SCHEMA_PATH)).validate(
        load_json(EXAMPLE_DIR / "pre_signature_validation.request.json")
    )


def test_example_response_validates_against_schema():
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(
        load_json(EXAMPLE_DIR / "pre_signature_validation.response.json")
    )


def test_use_case_inline_examples_validate():
    """The Input/Output shape blocks in the use-case doc are copied as templates,
    so they must conform to the request/response schemas (guards a missing
    required field such as owner_actions)."""
    blocks = re.findall(r"```json\n(.*?)```", USE_CASE_PATH.read_text(), re.DOTALL)
    assert len(blocks) >= 2, "expected an Input shape and an Output shape json block"
    Draft202012Validator(load_json(REQUEST_SCHEMA_PATH)).validate(json.loads(blocks[0]))
    Draft202012Validator(load_json(RESPONSE_SCHEMA_PATH)).validate(json.loads(blocks[1]))


def test_taxonomy_source_types_are_subset_of_request_enum():
    taxonomy = load_json(TAXONOMY_PATH)
    enum = request_enum()
    typed_keys = [k for k, v in taxonomy.items() if isinstance(v, list) and k != "watch_indicators"]
    referenced = {item for key in typed_keys for item in taxonomy[key]}
    missing = referenced - enum
    assert not missing, f"source-requirement types absent from request enum: {sorted(missing)}"


def test_regulatory_setup_types_present_in_enum_and_taxonomy():
    enum = request_enum()
    assert REGULATORY_SETUP_TYPES <= enum, "regulatory-setup types missing from request enum"
    taxonomy = load_json(TAXONOMY_PATH)
    referenced = {item for v in taxonomy.values() if isinstance(v, list) for item in v}
    assert REGULATORY_SETUP_TYPES <= referenced, "regulatory-setup types not mapped in source taxonomy"


def test_ip_and_data_types_present_in_enum_and_taxonomy():
    enum = request_enum()
    assert IP_AND_DATA_TYPES <= enum, "IP / data types missing from request enum"
    taxonomy = load_json(TAXONOMY_PATH)
    referenced = {item for v in taxonomy.values() if isinstance(v, list) for item in v}
    assert IP_AND_DATA_TYPES <= referenced, "IP / data types not mapped in source taxonomy"


def test_dual_copy_in_sync():
    pairs = [
        (REQUEST_SCHEMA_PATH, DATA_DIR / "schemas" / "v1" / "market-entry-readiness-request.schema.json"),
        (RESPONSE_SCHEMA_PATH, DATA_DIR / "schemas" / "v1" / "market-entry-readiness-response.schema.json"),
        (TAXONOMY_PATH, DATA_DIR / "source-requirements" / "kazakhstan-market-entry-readiness.json"),
    ]
    for top, packaged in pairs:
        assert top.read_text() == packaged.read_text(), f"dual-copy drift: {packaged.relative_to(ROOT)}"
