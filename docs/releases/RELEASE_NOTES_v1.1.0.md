# v1.1.0 - A2A protocol v1.0 wire + Worker parity + cost accounting

v1.1.0 upgraded the A2A wire contract, brought the deployed Worker closer to
Python service parity, and added per-task cost accounting. The schema freeze
from ADR 0003 and the request/memo contract were unchanged.

## What changed

- Migrated the A2A wire contract to A2A protocol v1.0 per ADR 0017.
- Preserved inbound parsing for both A2A v0.3 and v1.0.
- Added Python agent-card `supportedInterfaces[]`.
- Brought the Cloudflare Worker closer to Python service parity for Middle
  Corridor jurisdiction flags, exposure decomposition, and the vessel
  due-diligence checklist.
- Added per-task cost accounting and budget thresholds in `/stats`.
- Added Middle Corridor re-export / circumvention-watch jurisdiction flag,
  `exposure_layers`, and vessel deceptive-shipping-practice checklist.
- Tightened MCP category tool arguments to the packaged enum and corrected the
  stale `energy-markets` slug to `energy`.

## What did not change

- No breaking change to the frozen request/memo contract.
- No factual-verification, advice, or autonomous decision boundary changed.
- Worker changes still required manual `wrangler deploy`; merge alone did not
  deploy live Workers.

## Reference

GitHub release:
<https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/tag/v1.1.0>
