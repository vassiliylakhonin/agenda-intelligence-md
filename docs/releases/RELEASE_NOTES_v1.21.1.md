# 1.21.1 — Plugin x402 admission compatibility

Production verification of 1.21.0 found an additional transport edge case: the
dedicated Output plugin URL returned an x402 v2 admission challenge as HTTP 402
REST data. Standard MCP clients need a tool error in HTTP 200, as already served
by `/mcp/agent`. The plugin's free tools and new citation form were unaffected.

Both standard client paths now share one admission-path predicate for legacy
and x402 v2 handling, including unavailable/failed x402 responses. The exact
request URL, payment headers and explicit unevaluated status are retained.
`/mcp` and REST preserve their existing direct HTTP statuses. No payment, retry,
evaluation, quota or authorization is added by this change.

The regression reproduces the production `X402_STANDARD=1` configuration and
checks challenges/failures across both MCP client paths, legacy MCP and REST.
Full repository tests, packaging and protected deployment checks remain required.
No live model call or paid settlement was exercised.
