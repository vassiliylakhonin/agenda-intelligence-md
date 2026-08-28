# Agenda Intelligence MD — evidence-based concept deck

> Status: portfolio concept, not a fundraising or traction claim. No customers,
> pilots, revenue, market-size validation, or production guarantees are asserted.

## 1. Problem

LLM-generated reports can contain broken source references, misquoted passages,
unsupported numbers, and claims whose wording is stronger than their supplied
evidence. A fluent response can therefore look review-ready when its evidence
packet is incomplete.

## 2. Product boundary

Agenda Intelligence MD is a deterministic evidence-packet linter. It checks
packet structure, claim-to-source references, declared quotes, lexical support,
and unmatched numbers. It reports packet completeness, not factual truth,
legal clearance, sanctions status, or compliance approval.

## 3. Shipped surfaces

- Python package and CLI.
- MCP stdio server.
- Thin HTTP and A2A adapters.
- Cloudflare Worker demonstrations for bounded vertical profiles.
- JSON Schema contracts and regression fixtures.

Each surface ultimately exposes the same evidence-readiness boundary. Hosted
vertical profiles remain demonstrations unless their own status documents say
otherwise.

## 4. Why deterministic checks help

- Failures can be reproduced without model variance.
- Reviewers receive specific broken references and quote mismatches.
- An agent can receive a bounded repair prompt instead of a vague retry.
- The checker remains useful across model providers because the packet contract
  is independent of the model that drafted it.

These properties are supported by the repository tests. They are not evidence
of adoption or of improved real-world decisions.

## 5. Flagship demonstration

The repository includes cross-border-risk profiles that show how one evidence
contract can be specialized for sanctions, corridor, maritime, market-entry,
dual-use, and critical-minerals workflows. They require human review and do not
make legal or compliance determinations.

## 6. Technical evidence

The public repository contains the implementation, versioned schemas, fixtures,
CI workflows, threat model, and release history. Test counts should be quoted
only from a named commit or CI run; no coverage percentage is claimed unless a
coverage report from that run is linked.

## 7. Commercial status

There is currently no verified customer, pilot, paid-usage, revenue, or pricing
evidence in this repository. Any price, buyer, or market-size hypothesis must be
treated as an experiment and validated outside the codebase before appearing in
external material.

## 8. Near-term validation plan

1. Recruit a small number of independent reviewers for real evidence packets.
2. Record false positives, false negatives, time-to-review, and reviewer trust.
3. Separate improvements to packet completeness from improvements to truth.
4. Test whether users return without assisted onboarding.
5. Define pricing only after observing a repeatable workflow and willingness to
   pay.

## 9. Investment status

No funding ask is stated here. A future investor deck should be generated only
from cited market research, repository metrics tied to a date and commit, and
verifiable customer evidence.
