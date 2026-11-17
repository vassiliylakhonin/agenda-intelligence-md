# Aktau–Baku shipment file for review

Synthetic example for a freight forwarder's pre-signature handoff. This file
focuses on the Caspian leg of the [example request](01-request.json). Evidence
comes from the [dated source register](02-dated-sources.json) and [saved gap result](05-evidence-gaps.json).

**Requested decision** — can the case be sent to the internal reviewer?
**Current state** — operations should close the gaps below before sending it.
The forwarder assigns actual owners and sets deadlines for a live case.

| Record | Locator | Status |
| --- | --- | --- |
| Port operator notice | [e1, 20 May](02-dated-sources.json) | Supplied in the fixture |
| Screening export | [e2, 21 May](02-dated-sources.json) | Caller reports no exact match. Preserve the provider, scope and screened subject ID on a live export. |
| Carrier routing note | [e3, 22 May](02-dated-sources.json) | Supplied in the fixture |

| Open item | Suggested owner | Before handoff |
| --- | --- | --- |
| Counterparty registry extract | Onboarding | Attach the dated extract and registry ID. |
| Beneficial ownership | Trade compliance | Attach the ownership record and note unresolved entities. |
| Customs or regulatory source | Customs broker | Cite the relevant document and section. |
| Insurance clause or underwriter note | Insurance desk | Attach the coverage evidence and identify relevant exclusions by page. |
| Independent vessel or carrier history | Carrier operations | Attach a dated result using the carrier ID or vessel IMO number. |

## Run a five-file pilot

1. Ask an operations owner and their reviewer to select five completed cases.
   Use the team's approved storage and existing handoff format. Use redacted
   copies for any review outside that storage.
2. Record the original time to first usable handoff and the reviewer's
   reasons for sending each case back. Keep these labels separate until
   assessing the new handoff.
3. Rebuild the register and list of gaps. For every attached record keep
   its document ID, date and page or record locator. For a screening export,
   keep its provider, subject identifier, scope, timestamp and result reference.
   Mark unverifiable or missing records explicitly.
4. Have the same reviewer mark true gaps, missed items and false gaps.
   Compare time and returns against the original procedure. Ask the operations
   owner whether the next batch would justify a paid fixed-scope handoff.

For Gulf voyages, use the same handoff with the
[vessel and voyage evidence requirements](../../docs/use-cases/gulf-maritime-exposure.md).
The reviewer makes the decision using the documents and approved screening
sources in their own process.
