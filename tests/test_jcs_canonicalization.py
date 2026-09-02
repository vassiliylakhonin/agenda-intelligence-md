"""Contract tests for RFC 8785 canonicalization and the decision-Gate hashes.

The contract under test is cross-language: `agenda_intelligence.canonical` and
`jcs()` in `deploy/cloudflare-worker/src/jws.js` must produce byte-identical
output. The Worker signs a receipt over its hash; an enforcing caller computes
the expected hash here and sends it to `decision_verify`. Any divergence turns
into `binding_mismatch` on a request that both sides agree on, so the Gate
refuses a legitimate action and says nothing about why.

`tests/fixtures/jcs-parity.json` is generated from that JS file by
`scripts/generate-jcs-parity-fixture.mjs` and is the frozen half of the
contract. The regeneration test runs only where Node is available.
"""

import json
import os
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

import pytest

from agenda_intelligence.canonical import (
    ACTION_IDENTITY_FIELDS,
    action_identity,
    canonicalize,
    decision_request_hashes,
    ecmascript_number_to_string,
    sha256_jcs,
)
from agenda_intelligence.services import _input_digest

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "jcs-parity.json"
GENERATOR = ROOT / "scripts" / "generate-jcs-parity-fixture.mjs"


def parity_cases() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("name", sorted(parity_cases()))
def test_python_canonicalization_matches_the_worker_byte_for_byte(name: str) -> None:
    case = parity_cases()[name]
    assert canonicalize(case["value"]) == case["jcs"]
    assert sha256_jcs(case["value"]) == case["digest"]


@pytest.mark.skipif(shutil.which("node") is None, reason="Node is not available on this runner")
def test_the_fixture_still_matches_the_worker_canonicalizer() -> None:
    """Regenerating from jws.js must not change the committed fixture.

    Without this, a change to the Worker's `jcs()` would leave the Python side
    passing against a stale fixture while the live Gate hashed differently.
    """

    before = FIXTURE.read_text(encoding="utf-8")
    try:
        subprocess.run(["node", str(GENERATOR)], cwd=ROOT, check=True, capture_output=True)
        assert FIXTURE.read_text(encoding="utf-8") == before, (
            "jws.js and tests/fixtures/jcs-parity.json disagree; "
            "regenerate the fixture and check what changed in the Worker"
        )
    finally:
        FIXTURE.write_text(before, encoding="utf-8")


class TestEcmascriptNumbers:
    """RFC 8785 defers number formatting to ECMAScript, not to the host language."""

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            (9.0, "9"),  # Python renders 9.0
            (-0.0, "0"),  # Python renders -0.0
            (1e-7, "1e-7"),  # Python renders 1e-07
            (1e-6, "0.000001"),  # Python renders 1e-06
            (1e-5, "0.00001"),  # Python renders 1e-05
            (1e20, "100000000000000000000"),  # Python renders 1e+20
            (1e21, "1e+21"),  # the exponent boundary, where both agree again
            (1e22, "1e+22"),
            (0.1, "0.1"),
            (1 / 3, "0.3333333333333333"),
            (5e-324, "5e-324"),
            (1.7976931348623157e308, "1.7976931348623157e+308"),
        ],
    )
    def test_number_rendering_follows_ecmascript(self, value: float, expected: str) -> None:
        assert ecmascript_number_to_string(value) == expected

    def test_an_integer_and_its_float_hash_the_same(self) -> None:
        """A threshold that arrives as 9 and one that arrives as 9.0 are one request.

        JSON has one number type and the Worker parses both to the same double,
        so binding them to different hashes would refuse the second caller for
        having used a float.
        """

        assert sha256_jcs({"threshold": 9}) == sha256_jcs({"threshold": 9.0})

    @pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
    def test_non_finite_numbers_are_refused(self, value: float) -> None:
        with pytest.raises(ValueError, match="non-finite"):
            canonicalize({"amount": value})


class TestKeyOrdering:
    def test_keys_are_ordered_by_utf16_code_unit_not_code_point(self) -> None:
        """The one ordering rule Python gets wrong by default.

        U+1F600 is the surrogate pair D83D DE00, so UTF-16 order puts it before
        U+FFFD; Python's own `sorted` puts it after. A request carrying an
        emoji or any other astral key would hash differently on the two sides.
        """

        payload = {"\U0001f600": 1, "�": 2, "a": 3}
        assert list(json.loads(canonicalize(payload))) == ["a", "\U0001f600", "�"]
        assert sorted(payload) == ["a", "�", "\U0001f600"]

    def test_nested_objects_are_ordered_too(self) -> None:
        assert canonicalize({"b": [1, {"z": "y", "a": "b"}], "a": None}) == '{"a":null,"b":[1,{"a":"b","z":"y"}]}'


class TestUnicodeNormalizationIsTheCallersJob:
    """A limit of JCS, pinned so it stays visible rather than being rediscovered.

    RFC 8785 canonicalizes structure, not text: it sorts keys and fixes number
    and escape rendering, and it does not normalize Unicode. Two spellings of
    the same name therefore hash differently, and the Gate answers
    `binding_mismatch` for what a reader would call the same request. This
    matters for the regions this product targets, where NFC and NFD text both
    reach a caller by ordinary routes — macOS filesystem paths, clipboard, and
    some IMEs produce decomposed forms.

    The fix is not to normalize inside the canonicalizer, which would diverge
    from the Worker and from RFC 8785. It is for both parties to normalize
    before hashing.
    """

    NAME = "Айдын Жумабай"

    def test_nfc_and_nfd_hash_differently(self) -> None:
        nfc = unicodedata.normalize("NFC", self.NAME)
        nfd = unicodedata.normalize("NFD", self.NAME)
        assert nfc != nfd
        assert sha256_jcs({"actor": nfc}) != sha256_jcs({"actor": nfd})

    def test_normalizing_first_makes_them_agree(self) -> None:
        nfd = unicodedata.normalize("NFD", self.NAME)
        assert sha256_jcs({"actor": unicodedata.normalize("NFC", nfd)}) == sha256_jcs(
            {"actor": unicodedata.normalize("NFC", self.NAME)}
        )


class TestDecisionHashes:
    REQUEST = {
        "actor": "ops-bot",
        "requested_action": "release_payment",
        "target": "counterparty-4471",
        "risk_tier": "high",
        "run_id": "run-2026-09-02-001",
    }

    def test_action_identity_carries_the_four_bound_fields(self) -> None:
        assert action_identity(self.REQUEST) == {
            "actor": "ops-bot",
            "requested_action": "release_payment",
            "target": "counterparty-4471",
            "risk_tier": "high",
        }
        assert set(ACTION_IDENTITY_FIELDS) == set(action_identity(self.REQUEST))

    def test_a_missing_field_is_null_rather_than_absent(self) -> None:
        """The Worker reads the four fields off the object and JCS keeps a null.

        Dropping the key instead would hash a three-field object and mismatch a
        receipt the Gate issued for a request with no `target`.
        """

        assert action_identity({"actor": "a"})["target"] is None

    def test_hashes_match_the_shape_decision_verify_requires(self) -> None:
        hashes = decision_request_hashes(self.REQUEST)
        assert set(hashes) == {"request_hash", "action_hash"}
        for value in hashes.values():
            assert value.startswith("sha256:") and len(value) == 71

    def test_the_two_hashes_are_distinct_bindings(self) -> None:
        """Changing a field outside the action identity moves only one hash."""

        other = dict(self.REQUEST, run_id="run-2026-09-02-002")
        first, second = decision_request_hashes(self.REQUEST), decision_request_hashes(other)
        assert first["request_hash"] != second["request_hash"]
        assert first["action_hash"] == second["action_hash"]

    def test_changing_the_action_moves_both(self) -> None:
        other = dict(self.REQUEST, requested_action="freeze_account")
        first, second = decision_request_hashes(self.REQUEST), decision_request_hashes(other)
        assert first["request_hash"] != second["request_hash"]
        assert first["action_hash"] != second["action_hash"]

    def test_run_provenance_digest_is_a_different_algorithm_and_stays_that_way(self) -> None:
        """`_input_digest` must not be used to compute a Gate hash.

        It is `json.dumps(sort_keys=True)`, which is not JCS: it renders 9.0 as
        `9.0` where ECMAScript renders `9`. It stamps `run_provenance` on a
        structured response, which no receipt is bound to. Wiring it into
        `decision_verify` would pass on ASCII integers and fail on the first
        float, which is the worst way for this to be discovered.
        """

        assert _input_digest({"threshold": 9.0}) != sha256_jcs({"threshold": 9.0})
        assert _input_digest({"threshold": 9}) == sha256_jcs({"threshold": 9})


class TestDecisionHashesCommand:
    """The CLI is the surface an enforcing caller actually reaches for."""

    CLI = [sys.executable, "-m", "agenda_intelligence.cli", "decision-hashes"]
    ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}

    def run(self, *args: str, expect_zero: bool = True) -> subprocess.CompletedProcess:
        result = subprocess.run(self.CLI + list(args), capture_output=True, text=True, cwd=ROOT, env=self.ENV)
        if expect_zero:
            assert result.returncode == 0, f"cmd failed ({result.returncode}): {result.stderr}"
        return result

    def write_request(self, tmp_path: Path, payload: dict) -> str:
        target = tmp_path / "request.json"
        target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return str(target)

    def test_it_prints_the_two_hashes_decision_verify_asks_for(self, tmp_path: Path) -> None:
        path = self.write_request(tmp_path, dict(TestDecisionHashes.REQUEST))
        stdout = self.run(path, "--format", "json").stdout
        assert json.loads(stdout) == decision_request_hashes(TestDecisionHashes.REQUEST)

        text = self.run(path).stdout
        assert "expected_request_hash=sha256:" in text
        assert "expected_action_hash=sha256:" in text

    def test_normalize_changes_the_hash_of_decomposed_text(self, tmp_path: Path) -> None:
        decomposed = unicodedata.normalize("NFD", "Айдын Жумабай")
        path = self.write_request(tmp_path, dict(TestDecisionHashes.REQUEST, actor=decomposed))
        raw = json.loads(self.run(path, "--format", "json").stdout)
        nfc = json.loads(self.run(path, "--format", "json", "--normalize", "nfc").stdout)
        assert raw != nfc
        assert nfc == decision_request_hashes(
            dict(TestDecisionHashes.REQUEST, actor=unicodedata.normalize("NFC", decomposed))
        )

    def test_a_malformed_request_exits_non_zero(self, tmp_path: Path) -> None:
        broken = tmp_path / "broken.json"
        broken.write_text("{not json", encoding="utf-8")
        assert self.run(str(broken), expect_zero=False).returncode != 0

        not_an_object = self.write_request(tmp_path, ["actor"])  # type: ignore[arg-type]
        assert self.run(not_an_object, expect_zero=False).returncode != 0

        assert self.run(str(tmp_path / "absent.json"), expect_zero=False).returncode != 0


class TestRejectedInput:
    def test_an_unsupported_type_is_refused_rather_than_coerced(self) -> None:
        with pytest.raises(TypeError, match="cannot serialize"):
            canonicalize({"when": object()})

    def test_empty_containers_survive(self) -> None:
        assert canonicalize({"list": [], "object": {}, "text": ""}) == '{"list":[],"object":{},"text":""}'
