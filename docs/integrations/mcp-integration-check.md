# MCP Integration Check

A bounded pre-release check for MCP service developers, using the official
Python MCP SDK 1.30.0. Python 3.10+ is required for this optional extra:

```sh
python -m pip install 'agenda-intelligence-md[mcp-check]'
agenda-mcp-check examples/mcp-integration-check/stdio.json --strict --out mcp-report.json
```

The repository's stdio example launches the installed server, initializes a real
client, lists all tool pages, validates input/output JSON Schemas, requires
JSON-RPC `-32601` for an unknown method, and calls the explicitly configured
`list_signals` example. It performs no purchases or hosted paid tool calls.

For a remote endpoint, create an operator-authored config:

```json
{
  "transport": "streamable_http",
  "url": "https://your-server.example/mcp",
  "auth": "required",
  "token_env": "MCP_CHECK_TOKEN",
  "execute_examples": false,
  "examples": []
}
```

Use `auth: "none"` explicitly for a public endpoint, without `token_env`.
For required auth the checker sends an unauthenticated initialize, requires a
401 Bearer challenge, checks same-origin protected resource metadata describing
the endpoint, then connects with the supplied bearer. This does not implement
OAuth login, refresh or credential acquisition. An accidentally public endpoint
fails a required-auth check. Metadata issuer URLs must use HTTPS.

Tool execution requires **both** `execute_examples: true` and configured examples:
`{"tool": "echo", "arguments": {"value": 7}, "expected_is_error": false}`.
Only operator-selected examples execute. Tool descriptions, discovery responses
and example instructions returned by the server cannot authorize another call.
Only use dedicated test data and credentials: opted-in tools can have effects.
Before a consequential example call, record an inspectable decision workspace:
goal, trusted evidence, suspected unreliable evidence, assumptions, intended
action and stop/escalation conditions. Configuration opt-in is not a substitute
for the caller's authority to perform that tool's action.

## GitHub Action

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-python@v5
    with:
      python-version: '3.12'
  - uses: vassiliylakhonin/agenda-intelligence-md/actions/mcp-integration-check@v1.16.0
    with:
      config: checks/mcp.json
      report: mcp-report.json
    env:
      MCP_CHECK_TOKEN: ${{ secrets.MCP_CHECK_TOKEN }}
```

Pin the action to an inspected commit for production. The action installs this
repository's checker plus the pinned optional SDK and runs strict mode. Use a
trusted configuration: a stdio `command` is a real local program, and opted-in
examples execute real calls. Never run untrusted PR configs with privileged
credentials. The [smoke workflow](../../.github/workflows/preflight-smoke.yml)
tests real stdio and loopback HTTP clients without secrets.

## Contract and limits

Stable JSON `mcp-integration-check.v1` reports `status: passed|incomplete|failed`,
`client`, `client_version`, `transport`, `checks` and `limitations` on success.
Check rows contain `check`, `status` and relevant protocol/catalog/example
details. Failure reports contain `error_type` and a bounded, credential-redacted
`error`. No token or full tool response is stored in the report.

`--strict` exits 0 for passed, 1 for failed and 2 for incomplete. Without strict
mode a report is produced even on failure. Discovery without opted-in examples
is intentionally incomplete. Configuration is at most 1 MiB; at most ten
examples, ten catalog pages and 500 tools; examples at most 64 KiB, schemas
256 KiB. HTTP responses are bounded to 2 MiB and a run to 45 seconds. HTTPS is
required except explicit loopback HTTP sandbox mode. Redirects and compressed
HTTP responses are rejected; remote schema reference retrieval is disabled.
These conservative restrictions can reject otherwise compatible servers.

This is a selected integration preflight, not MCP certification, a security
audit, a semantic tool correctness verdict or proof that every agent can connect.
