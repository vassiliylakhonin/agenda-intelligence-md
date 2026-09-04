# @agenda-intelligence/client

TypeScript client for the Agenda Intelligence MD HTTP shell. Types are generated
from `schemas/v1`, so they cannot drift from the contract: CI regenerates and
compares.

Pinned to package version `1.8.0`.

```ts
import { AgendaIntelligenceClient, RateLimitError } from "@agenda-intelligence/client";

const client = new AgendaIntelligenceClient({
  baseUrl: "https://checks.internal.example.com",
  apiKey: process.env.AGENDA_INTELLIGENCE_KEY,
});

try {
  const result = await client.preActionCheck(request, { requestId: correlationId });
  console.log(result.decision);
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait, do not retry immediately.
    await sleep(error.retryAfterSeconds * 1000);
  }
  throw error;
}
```

Every call throws `AgendaIntelligenceError` on a non-2xx answer, carrying the
status, the `x-request-id` the shell echoed, and the parsed error body. `429`
throws the `RateLimitError` subclass with `retryAfterSeconds`.

`health()` and `ready()` answer without a key. `ready()` reports the access
policy the instance is enforcing, which is the fastest way to tell a
misconfigured deployment from a rejected key.

Do not edit `src/types.ts` or `src/client.ts`. Run
`python3 scripts/generate_ts_client.py` from the repository root.
