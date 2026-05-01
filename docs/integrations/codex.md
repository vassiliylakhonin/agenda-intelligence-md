# OpenAI Codex Integration

Codex can invoke the CLI through a child process or a function wrapper.

The wrapper should:
1. Accept a **command** string (e.g., `validate-brief`).
2. Pass optional **args**.
3. Return stdout/stderr as JSON to the Codex output.
