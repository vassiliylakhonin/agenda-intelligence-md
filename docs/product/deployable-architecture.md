# Deployable architecture

Agenda Intelligence MD should remain deployable without making the core package depend on a marketplace, cloud vendor, billing system, or hosted runtime.

Neutral architecture direction:

```text
Core package
  ↓
MCP server
  ↓
HTTP API service
  ↓
A2A adapter
  ↓
Deployment packages
```

## Design rules

- The core package must stay clean and vendor-neutral.
- Shared service-layer functions should hold reusable behavior that adapters can call without depending on each other.
- Marketplace billing, cloud SDKs, and vendor-specific integration code must not live in core.
- The MCP server must remain simple, stable, and testable.
- The future HTTP API should be a thin wrapper around existing core functions.
- The future A2A layer should be an adapter over the HTTP/service layer.
- Deployment packages can be channel-specific, but channel concerns must not leak into core.

## Roadmap

- `1.0.x` - stable MCP/package contract.
- `1.1.0` - deployable HTTP API shell.
- `1.2.0` - A2A production adapter.
- `1.3.0` - entitlement/metering abstraction.
- `1.4.0` - marketplace packaging profiles.

These roadmap items are not implemented yet.
