# Source-backed Example: Sanctions Routing

**Bottom line:** Sanctions evasion is shifting from direct bank transfers to complex layering through regional jurisdictions. Financial institutions and compliance teams must update monitoring to track indirect exposure.

**Signal classification:** Weak signal / structural shift.

**What changed:** Increase in shell‑company registrations and trade‑through hubs in Central Asia & Caspian region, suggesting routing of restricted goods/funds.

**Institutional path:** OFAC/EEAS designations → national AML/CFT updates → correspondent banking restrictions → transaction‑monitoring rule changes.

**Affected flows:** Capital, trade finance, commodities, technology transfers, and insurance.

**Regulatory `source_plan`:** Use `sanctions` source plan to identify relevant data.

**Evidence mode:** Evidence references are marked as **EVIDENCE**. The source plan requires checking:

- `sanctions/*.json` files in `source-requirements`.
- Latest designation lists and enforcement actions.

> **Unsupported claims:** Any claim that cannot be mapped to a specific source or lacks a `must_check` entry is flagged as unsupported.

---

**Watch next:** New designations, enforcement actions, trade‑flow data, and corporate‑registry changes.
