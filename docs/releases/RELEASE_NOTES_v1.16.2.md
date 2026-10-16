# Agenda Intelligence MD 1.16.2

The PyPI description now includes native MCP trial onboarding and distinguishes
the installed local stdio catalog (32 tools) from each hosted product's catalog.
Repository documentation links in the README are absolute and pinned to this
release, so they can be followed from PyPI.

For a hosted Output Verification trial, connect to
`https://output-verification.agendamcp.dpdns.org/mcp/agent`, discover tools, call
`free_trial_status({})`, and submit your own input through `free_trial` using its
direct schema. No HTTP adapter or wallet is needed for the trial. The five
campaign attempts per network and shared daily capacity are unchanged.

Output tool descriptions distinguish answer-only evidence review, unsigned
action checks, and checks with signed readiness receipts. A receipt is evidence
of a bounded readiness result, not authorization. The calling integration still
authenticates actors and enforces action restrictions; human review remains
required.

Existing tool names, argument schemas, paid admission, authentication and trial
quotas are preserved. The update does not add live source retrieval, factual
truth verification, autonomous approval, or evidence of customer adoption.
