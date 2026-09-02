"""Contract tests for deterministic candidate discovery.

The contract is a split: discovery is exhaustive and deterministic, judgement
stays with the reviewer. These tests hold both halves — that every source is
reached for every claim, and that nothing here is allowed to read as a verdict.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from agenda_intelligence import services
from agenda_intelligence.discovery import (
    MAX_PATTERNS_PER_CLAIM,
    claim_patterns,
    discover_sources,
)

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "schemas" / "v1" / "source-discovery-response.schema.json").read_text(encoding="utf-8"))


def packet(claims: list[dict], sources: list[dict]) -> dict:
    return {"packet_id": "test-packet", "claims": claims, "sources": sources}


CORPUS = [
    {
        "source_id": "call",
        "title": "Call for proposals",
        "text": (
            "LOT 2: Immunisation cold chain and last-mile delivery.\n"
            "Indicative envelope: EUR 3,800,000 over 24 months."
        ),
    },
    {"source_id": "budget", "title": "Budget note", "text": "BUDGET BY HEADING\nCold chain equipment 1,102,000"},
    {"source_id": "roster", "title": "Rosters", "text": "Maintenance teams operating in the northern district."},
]


class TestFindingWhatTheCitationMissed:
    """The question `check_evidence_packet` cannot ask, because it reads only what a claim named."""

    def test_the_better_source_surfaces_even_though_the_claim_does_not_cite_it(self) -> None:
        response = discover_sources(
            packet(
                [
                    {
                        "claim_id": "c1",
                        "text": "The indicative envelope is EUR 3,800,000 over 24 months for immunisation cold chain.",
                        "source_ids": ["budget"],
                    }
                ],
                CORPUS,
            )
        )
        claim = response["claims"][0]
        assert claim["candidates"][0]["source_id"] == "call"
        assert claim["candidates"][0]["declared"] is False
        assert "call" in claim["undeclared_candidates"]

    def test_a_citation_to_a_document_containing_nothing_is_named(self) -> None:
        """The failure mode that reads as 'weak support' and is actually a wrong reference."""

        response = discover_sources(
            packet(
                [{"claim_id": "c1", "text": "Immunisation cold chain envelope 3,800,000.", "source_ids": ["roster"]}],
                CORPUS,
            )
        )
        assert response["claims"][0]["declared_without_match"] == ["roster"]

    def test_a_correctly_cited_claim_reports_nothing_to_fix(self) -> None:
        response = discover_sources(
            packet(
                [{"claim_id": "c1", "text": "Cold chain equipment costs 1,102,000.", "source_ids": ["budget"]}],
                CORPUS,
            )
        )
        claim = response["claims"][0]
        assert claim["declared_without_match"] == []
        assert claim["candidates"][0]["source_id"] == "budget"
        assert claim["candidates"][0]["declared"] is True


class TestExhaustiveAndDeterministic:
    """The property that makes the same behaviour hold on 40 sources and on 4,000."""

    def test_every_source_is_scanned_however_many_there_are(self) -> None:
        sources = [{"source_id": f"s{i:04d}", "text": f"filler document {i}"} for i in range(400)]
        sources.append({"source_id": "needle", "text": "The certified total was 812 after deduplication."})
        response = discover_sources(packet([{"claim_id": "c1", "text": "812 certified.", "source_ids": []}], sources))
        assert response["corpus"]["sources_scanned"] == 401
        assert response["claims"][0]["candidates"][0]["source_id"] == "needle"

    def test_the_result_does_not_depend_on_corpus_order(self) -> None:
        claims = [{"claim_id": "c1", "text": "Immunisation cold chain envelope 3,800,000.", "source_ids": []}]
        forward = discover_sources(packet(claims, CORPUS))
        backward = discover_sources(packet(claims, list(reversed(CORPUS))))
        assert [c["source_id"] for c in forward["claims"][0]["candidates"]] == [
            c["source_id"] for c in backward["claims"][0]["candidates"]
        ]

    def test_the_same_input_gives_the_same_output(self) -> None:
        request = packet([{"claim_id": "c1", "text": "Cold chain 1,102,000.", "source_ids": []}], CORPUS)
        assert discover_sources(request) == discover_sources(request)

    def test_the_matched_line_is_reported_so_a_reviewer_can_go_to_it(self) -> None:
        response = discover_sources(
            packet([{"claim_id": "c1", "text": "Envelope of 3,800,000 over 24 months.", "source_ids": []}], CORPUS)
        )
        best = response["claims"][0]["candidates"][0]["best_line"]
        assert best["line"] == 2
        assert "3,800,000" in best["text"]


class TestPatterns:
    def test_numbers_come_first_and_survive_the_cap(self) -> None:
        text = "The budget is 3,800,000 and " + " ".join(f"filler{i}" for i in range(40))
        patterns = claim_patterns(text)
        assert len(patterns) == MAX_PATTERNS_PER_CLAIM
        assert patterns[0]["kind"] == "number"

    def test_a_number_outweighs_a_term(self) -> None:
        """Co-occurring on a figure is far stronger evidence than sharing a word."""

        sources = [
            {"source_id": "figure", "text": "The total was 3,800,000."},
            {"source_id": "word", "text": "immunisation programme overview"},
        ]
        response = discover_sources(
            packet([{"claim_id": "c1", "text": "immunisation total 3,800,000", "source_ids": []}], sources)
        )
        assert response["claims"][0]["candidates"][0]["source_id"] == "figure"

    def test_cyrillic_and_arabic_claims_produce_patterns(self) -> None:
        assert claim_patterns("Совет директоров одобрил проект.")
        assert claim_patterns("وافق مجلس الإدارة على المشروع.")


class TestDiscoveryDoesNotClaimToBeRetrieval:
    """Limits pinned so they stay visible instead of being rediscovered in use."""

    def test_discovery_does_not_claim_to_find_paraphrase(self) -> None:
        """A supporting source sharing no token with the claim will not appear.

        This is the boundary of the whole approach: it matches literals, so a
        source that says the same thing in different words is invisible to it.
        No ranking, weighting or cap changes that, and a reviewer who assumes
        the candidate list is complete will be wrong in exactly this case.
        """

        sources = [{"source_id": "paraphrase", "text": "The governing body gave its assent to the undertaking."}]
        response = discover_sources(
            packet([{"claim_id": "c1", "text": "The board approved the project.", "source_ids": []}], sources)
        )
        assert response["claims"][0]["candidates"] == []

    def test_a_candidate_is_never_reported_as_a_verdict(self) -> None:
        response = discover_sources(
            packet([{"claim_id": "c1", "text": "Cold chain 1,102,000.", "source_ids": []}], CORPUS)
        )
        assert response["discovery_status"] == "candidates_only"
        assert len(response["limitations"]) >= 3
        # The prose in `limitations` is allowed to use these words to deny them;
        # the findings themselves must not carry any of them as a field.
        findings = json.dumps(response["claims"])
        for forbidden in ("verified", "supported", "packet_complete", "factuality", "verdict"):
            assert forbidden not in findings

    def test_a_high_score_is_still_only_lexical_overlap(self) -> None:
        """A source that denies the claim ranks alongside one that supports it.

        Discovery weighs shared literals, and a denial shares nearly all of
        them. `against` scores within a hair of `for` here, which is the whole
        reason the score is documented as an ordering and not a judgement:
        reading a high candidate as support gets this case backwards. Polarity
        is checked later, by `check_evidence_packet`, against the source a
        reviewer actually accepted.
        """

        sources = [
            {"source_id": "for", "text": "The board approved the 3,800,000 budget."},
            {"source_id": "against", "text": "The board did not approve the 3,800,000 budget."},
        ]
        response = discover_sources(
            packet([{"claim_id": "c1", "text": "The board approved the 3,800,000 budget.", "source_ids": []}], sources)
        )
        scores = {c["source_id"]: c["score"] for c in response["claims"][0]["candidates"]}
        assert scores["against"] > 0.8
        assert scores["for"] - scores["against"] < 0.1


class TestServiceContract:
    def test_a_golden_request_validates_against_the_response_schema(self) -> None:
        result = services.discover_evidence_sources(
            packet([{"claim_id": "c1", "text": "Envelope 3,800,000.", "source_ids": ["call"]}], CORPUS)
        )
        assert result["valid"] is True
        Draft202012Validator(SCHEMA).validate(result["response"])
        assert result["response"]["run_provenance"]["schema_id"].endswith("source-discovery-response.schema.json")

    def test_a_malformed_request_is_refused_with_the_errors(self) -> None:
        result = services.discover_evidence_sources({"claims": "not-an-array"})
        assert result["valid"] is False
        assert result["response"] is None
        assert result["errors"]

    def test_an_empty_corpus_answers_rather_than_failing(self) -> None:
        result = services.discover_evidence_sources(
            {"packet_id": "p", "claims": [{"claim_id": "c1", "text": "anything", "source_ids": []}], "sources": []}
        )
        assert result["valid"] is True
        assert result["response"]["claims"][0]["candidates"] == []
        Draft202012Validator(SCHEMA).validate(result["response"])


class TestDiscoverCommand:
    CLI = [sys.executable, "-m", "agenda_intelligence.cli", "discover"]
    ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}

    def run(self, *args: str, expect_zero: bool = True) -> subprocess.CompletedProcess:
        result = subprocess.run(self.CLI + list(args), capture_output=True, text=True, cwd=ROOT, env=self.ENV)
        if expect_zero:
            assert result.returncode == 0, f"cmd failed ({result.returncode}): {result.stderr}"
        return result

    def test_it_reads_the_shipped_review_manifest(self) -> None:
        out = self.run(str(ROOT / "examples" / "evidence-review" / "manifest.json"), "--format", "json").stdout
        response = json.loads(out)
        Draft202012Validator(SCHEMA).validate(response)
        assert response["corpus"]["sources_scanned"] == 2

    def test_it_reads_an_inline_packet_too(self, tmp_path: Path) -> None:
        target = tmp_path / "packet.json"
        target.write_text(
            json.dumps(packet([{"claim_id": "c1", "text": "Envelope 3,800,000.", "source_ids": []}], CORPUS)),
            encoding="utf-8",
        )
        assert "call" in self.run(str(target)).stdout

    def test_strict_fails_on_a_citation_that_reaches_nothing(self, tmp_path: Path) -> None:
        target = tmp_path / "packet.json"
        target.write_text(
            json.dumps(packet([{"claim_id": "c1", "text": "Envelope 3,800,000.", "source_ids": ["roster"]}], CORPUS)),
            encoding="utf-8",
        )
        assert self.run(str(target), expect_zero=True).returncode == 0
        strict = self.run(str(target), "--strict", expect_zero=False)
        assert strict.returncode == 1
        assert "declared source" in strict.stderr

    def test_a_missing_file_exits_non_zero(self, tmp_path: Path) -> None:
        assert self.run(str(tmp_path / "absent.json"), expect_zero=False).returncode != 0


def test_the_schema_is_registered_in_the_manifest() -> None:
    manifest = json.loads((ROOT / "agent-manifest.json").read_text(encoding="utf-8"))
    entry = manifest["schemas"]["source_discovery_response"]
    assert entry["path"] == "schemas/v1/source-discovery-response.schema.json"
    assert entry["schema_version"] == "v1"


@pytest.mark.parametrize("field", ["undeclared_candidates", "declared_without_match"])
def test_the_actionable_fields_are_always_present(field: str) -> None:
    response = discover_sources(packet([{"claim_id": "c1", "text": "anything at all", "source_ids": []}], CORPUS))
    assert field in response["claims"][0]
