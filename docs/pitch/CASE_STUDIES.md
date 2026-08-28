# Agenda Intelligence MD — synthetic workflow scenarios

> These are design scenarios, not customers, deployments, pilots, measured
> outcomes, endorsements, or proof of legal or regulatory compliance. Every
> organisation, volume, and packet described below is hypothetical.

## Scenario 1: Middle Corridor evidence intake

A trade-finance reviewer receives a shipment packet containing a bill of lading,
cargo certificate, counterparty declaration, and ownership documents. The
`middle_corridor_deal_risk` profile can check whether required evidence objects
are present and whether claims cite the supplied records.

The checker cannot determine sanctions status, beneficial ownership, legality,
or whether the shipment should proceed. A useful evaluation would measure which
missing documents reviewers catch with and without the checker, including false
positives and false negatives.

## Scenario 2: Agent action step-up

An agent requests a consequential action without supplying the authority fields
required by the `agentic_interaction_trust` contract. The deterministic gate can
return a structured request for additional evidence instead of treating the
request as authorized.

The repository does not authenticate a person, verify biometrics, settle a
payment, prevent fraud, or prove an agent's identity. Those controls belong to
the integrating system and require their own security assessment.

## Scenario 3: Critical-minerals report review

A synthetic report contains quantities, dates, quoted permit language, and
source references. `check_evidence_packet` can detect missing references, quote
mismatches, unmatched numbers, and some polarity mismatches inside that supplied
packet.

Passing the linter does not prove the documents are authentic, current, complete,
or sufficient for an investment or regulatory decision. A future study should
use independently labelled packets and publish the dataset, commit, rubric, and
error analysis.

## Evidence required before calling these case studies

Replace “scenario” with “case study” only after obtaining permission to publish
and linking claims to a dated study protocol, source dataset, observed results,
limitations, and the participating organisation's confirmation.
