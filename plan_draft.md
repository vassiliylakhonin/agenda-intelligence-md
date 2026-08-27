# Ecosystem Expansion Execution Plan

## 1. Live Retrieval (Free API)
We will switch the `cis_secondary_sanctions` live retrieval to use the free **OpenSanctions Open Data / Bulk JSON** (CC-BY 4.0) instead of the paid API. We already have a snapshot mechanism (`SNAPSHOT_INDEX_URL`) in the `wrangler.toml`! We will activate this mechanism natively so the agent can do real name-screening without per-call costs.

## 2. Generative UI Expansion
We will integrate the Tailwind HTML generation directly into the Python service layer.
- Add `requested_output="html"` support to the workers.
- When requested, the agent will return the dashboard HTML inside the `mediaType: "text/html"` part of the artifact response, allowing instant rendering in agentic UI clients.

## 3. Fleet Distribution Script
We will create `scripts/publish-fleet.js` that:
- Reads all 10 worker hostnames from `wrangler.toml` / `agent-manifest.json`.
- Hits their `/.well-known/agent-card.json` to verify they are alive.
- Generates a consolidated `fleet-directory.md` and (mock) registers them with an AI catalog endpoint.

## 4. Self-Correction Swarm Simulation
We will build a new executable example: `examples/multi-agent-swarm.py`.
- It will load a deliberately flawed evidence packet.
- Agent A (Verifier) will run `check_evidence_packet` and generate a `repair-prompt`.
- Agent B (Researcher) will take the repair prompt, automatically fix the JSON, and resubmit it.
- The loop continues until the packet is 100% green.
