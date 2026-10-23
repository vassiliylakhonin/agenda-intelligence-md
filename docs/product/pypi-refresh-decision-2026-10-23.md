# PyPI 1.21.2 refresh

- goal: update the public PyPI package and its description to the tested current source, including a checkout-free first example and accurate hosted-workflow links.
- trusted_evidence: official PyPI JSON API reports 1.21.1; clean main 0d83b68; existing package/Worker tests; documented release and post-release smoke workflows.
- suspected_unreliable_evidence: search/crawler copies can retain old PyPI descriptions; hosted features are not Python-wheel APIs; synthetic checks do not prove factual truth, demand or paid use.
- hidden_assumptions: a patch release is appropriate because no schema, tool, price, authentication or domain behavior is removed or changed.
- intended_next_action: synchronize 1.21.2 metadata and mirrors; refresh README/release notes; regenerate fixtures; run package/Worker gates and clean wheel smoke; merge, tag and publish through the existing GitHub workflow and secret; verify the public index and isolated install.
- stop_or_escalate_if: version collision, missing publisher access, mismatched artifacts/mirrors, failed required checks or changed authorization. Never read or expose the publishing token; do not overwrite/retag published versions or change publisher permissions.
