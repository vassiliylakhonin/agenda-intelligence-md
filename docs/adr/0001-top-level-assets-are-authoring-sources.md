# Top-level assets are authoring sources

Top-level protocols, schemas, skills, source policies, and manifests are the authoring sources for Agenda Intelligence MD; the copies under `src/agenda_intelligence/data` are packaged mirrors used by the installed CLI and MCP server at runtime. This keeps public documentation and external tooling discoverable at the repository root while still shipping byte-equal runtime assets inside the Python package, with tests guarding against drift.
