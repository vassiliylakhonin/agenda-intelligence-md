# Output Verification plugin

This package connects Claude, ChatGPT, and Codex to the existing Output Verification Worker at `https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp/output-verification`.

Start with `free_trial_status`, then choose `review_answer` for an answer plus actual source excerpts (citation/quote structure only), or `free_trial` for the claim/evidence audit. `validate_input` checks shape without evaluation. `free_trial_feedback` accepts optional feedback. `open_answer_review` opens an optional MCP Apps form without evaluation; clients without Apps use the ordinary tools and complete JSON text results.

Both free reviews share 5 campaign attempts per network and product, plus shared daily capacity. An admitted corrected rerun consumes another attempt. Opening the form, checking status and validating shape consume none. The separate `agent_output_verification` tool keeps normal paid admission. The plugin never pays or retries automatically.

The full audit checks whether supplied claim IDs, evidence IDs, support levels and quotes fit together. The compact review never assigns support levels or assesses semantic support. Neither fetches/authenticates sources, establishes truth, approves relay or authorizes action. Every result requires human review. Send only authorized material, without secrets or unrelated private data. See the [answer review contract](../../docs/deployment/answer-review.md).

## Contents

- `plugin.json` and `mcp.json`: portable Agent Plugins package.
- `.codex-plugin/plugin.json` and `.mcp.json`: Codex compatibility package.
- `.claude-plugin/plugin.json`: Claude Code package for the same endpoint.
- `skills/evidence-output-review/SKILL.md`: the review workflow.
- `REVIEW-CASES.md`: synthetic review cases.

All three manifests point to the dedicated MCP URL. Keep the package version aligned with the deployed Worker version. A local package can be installed and tested before public submission, but it will connect successfully only after the Worker change is deployed.

## Validate

From the repository root:

```sh
node scripts/check-output-verification-plugin.mjs
cd deploy/cloudflare-worker && npm test
```

The first command checks local package metadata and the local tool contract without network access. After the protected Worker deployment, run `node scripts/check-output-verification-plugin.mjs --live` to check the public endpoint's `initialize` and `tools/list` responses. The `--live` check never invokes `tools/call` or a paid action. You can additionally run the installed plugin-creator validator and validate the portable manifests against the Agent Plugins JSON schemas.

## Deploy and submit

The Worker route `/.well-known/openai-apps-challenge` returns the exact portal-issued token only when `OPENAI_APPS_CHALLENGE_TOKEN` is configured as a secret on the Output Verification profile. The token must never be committed. Coordinate installation of the secret with the repository's protected deployment workflow; changing a Worker secret may deploy a new version. Verify the route and the dedicated MCP URL after deployment.

For OpenAI, submit the dedicated public HTTPS MCP endpoint as **With MCP**. Upload the final `skills/evidence-output-review/` bundle to the same draft, or expose it through the MCP static-skills extension and import it with Scan Tools. A local `SKILL.md` is not automatically included when scanning ordinary MCP tools. Scan Tools again after any metadata change and inspect the captured tool list, schema, annotations, and skill. Complete domain verification, publisher identity, policy URLs, and the five positive and three negative cases in `REVIEW-CASES.md` before review. [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission)

For Claude, submit the bundle with `plugins/output-verification/` as the repository root, if the portal requires a root plugin manifest. A link to the main monorepo root would select a different plugin. Validate the package with Claude Code before submission. [Claude announcement](https://claude.com/blog/build-plugins-for-claude)

Publication, secret installation, and production deployment are separate owner actions. This package does not imply that either directory has accepted or published the plugin.
