#!/usr/bin/env python3
"""Generate the TypeScript client from the v1 schemas.

The schemas are the contract (ADR 0003, ADR 0011). A hand-written client drifts
from them; this one cannot, because `tests/test_ts_client_is_current.py` fails
when the checked-in output differs from what this script produces.

Only the subset the schemas actually use is supported: objects with properties
and required, arrays, enums, const, anyOf/oneOf, local `$ref` into `$defs`, and
additionalProperties. Anything outside it raises rather than emitting `any`.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "schemas" / "v1"
OUT = ROOT / "clients" / "typescript"

# One row per HTTP endpoint the portable shell exposes, in the order they appear
# in http_api.handle_post. `None` means the endpoint takes or returns a shape the
# schemas do not describe, and the client types it as a JSON object.
ENDPOINTS = [
    ("auditClaims", "POST", "/v1/audit-claims", None, None, "Audit claim/evidence references in an audit packet."),
    ("sourceCoverage", "POST", "/v1/source-coverage", None, None, "Report source coverage for an evidence pack."),
    ("score", "POST", "/v1/score", None, None, "Score a rewrite against the memo-quality rubric."),
    (
        "middleCorridorDealRisk",
        "POST",
        "/v1/middle-corridor/deal-risk",
        "middle-corridor-deal-risk-request",
        "middle-corridor-deal-risk-response",
        "Middle Corridor deal-risk triage.",
    ),
    (
        "agenticInteractionTrust",
        "POST",
        "/v1/agentic-interaction/trust",
        "agentic-interaction-trust-request",
        "agentic-interaction-trust-response",
        "Agentic interaction evidence triage.",
    ),
    (
        "cisSecondarySanctionsExposure",
        "POST",
        "/v1/cis-secondary-sanctions/exposure",
        "cis-secondary-sanctions-request",
        "cis-secondary-sanctions-response",
        "CIS secondary-sanctions exposure triage.",
    ),
    (
        "gulfMaritimeExposure",
        "POST",
        "/v1/gulf-maritime/exposure",
        "gulf-maritime-exposure-request",
        "gulf-maritime-exposure-response",
        "Gulf maritime exposure triage.",
    ),
    (
        "marketEntryReadiness",
        "POST",
        "/v1/market-entry/readiness",
        "market-entry-readiness-request",
        "market-entry-readiness-response",
        "Market-entry evidence-readiness triage.",
    ),
    (
        "criticalMineralsDueDiligence",
        "POST",
        "/v1/critical-minerals/due-diligence",
        "critical-minerals-due-diligence-request",
        "critical-minerals-due-diligence-response",
        "Critical-minerals due-diligence triage.",
    ),
    (
        "agentOutputVerification",
        "POST",
        "/v1/agent-output/verification",
        None,
        "agent-output-verification-response",
        "Verify an agent-output evidence packet and return repair guidance.",
    ),
    (
        "preActionCheck",
        "POST",
        "/v1/agent-output/pre-action-check",
        "pre-action-check-request",
        "pre-action-check-response",
        "Deterministic pre-action routing over claims and evidence.",
    ),
]


class Unsupported(RuntimeError):
    """A schema construct this generator will not guess at."""


def pascal(text: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in re.split(r"[^0-9a-zA-Z]+", text) if part)


def quote_key(name: str) -> str:
    return name if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", name) else json.dumps(name)


class Emitter:
    """Turns one schema file into named TypeScript declarations."""

    def __init__(self) -> None:
        self.blocks: list[str] = []
        self.emitted: set[str] = set()

    def add_schema(self, path: Path) -> str:
        schema = json.loads(path.read_text(encoding="utf-8"))
        root = pascal(schema.get("title") or path.stem)
        self._defs = schema.get("$defs", {})
        self._root = root
        for name, sub in self._defs.items():
            self._declare(f"{root}{pascal(name)}", sub, self._description(sub))
        self._declare(root, schema, self._description(schema))
        return root

    @staticmethod
    def _description(node: dict) -> str:
        return (node.get("description") or "").strip()

    def _declare(self, name: str, node: dict, description: str) -> None:
        if name in self.emitted:
            return
        self.emitted.add(name)
        body = self._type(node, name)
        doc = f"/** {description} */\n" if description else ""
        if body.startswith("{"):
            self.blocks.append(f"{doc}export interface {name} {body}")
        else:
            self.blocks.append(f"{doc}export type {name} = {body};")

    def _ref(self, ref: str) -> str:
        if not ref.startswith("#/$defs/"):
            raise Unsupported(f"only local $defs references are supported, got {ref!r}")
        key = ref.split("/")[-1]
        if key not in self._defs:
            raise Unsupported(f"$ref points at a missing definition: {ref!r}")
        return f"{self._root}{pascal(key)}"

    def _type(self, node: dict, owner: str, depth: int = 0) -> str:
        if "$ref" in node:
            return self._ref(node["$ref"])
        if "const" in node:
            return json.dumps(node["const"])
        if "enum" in node:
            return " | ".join(json.dumps(value) for value in node["enum"])
        for combiner in ("anyOf", "oneOf"):
            if combiner in node:
                return " | ".join(self._type(option, owner, depth) for option in node[combiner])

        kind = node.get("type")
        if isinstance(kind, list):
            return " | ".join(self._type({**node, "type": one}, owner, depth) for one in kind)
        if kind == "array":
            items = node.get("items")
            if items is None:
                raise Unsupported(f"{owner}: array without items")
            inner = self._type(items, owner, depth)
            return f"Array<{inner}>" if " " in inner else f"{inner}[]"
        if kind == "object" or "properties" in node:
            return self._object(node, owner, depth)
        if kind == "string":
            return "string"
        if kind in {"number", "integer"}:
            return "number"
        if kind == "boolean":
            return "boolean"
        if kind == "null":
            return "null"
        if kind is None:
            return "unknown"
        raise Unsupported(f"{owner}: unsupported type {kind!r}")

    def _object(self, node: dict, owner: str, depth: int) -> str:
        pad = "  " * (depth + 1)
        closing = "  " * depth
        required = set(node.get("required", []))
        lines: list[str] = []
        for key, sub in (node.get("properties") or {}).items():
            description = self._description(sub)
            if description:
                lines.append(f"{pad}/** {description} */")
            optional = "" if key in required else "?"
            lines.append(f"{pad}{quote_key(key)}{optional}: {self._type(sub, owner, depth + 1)};")
        extra = node.get("additionalProperties", True)
        if extra is True:
            lines.append(f"{pad}[key: string]: unknown;")
        elif isinstance(extra, dict):
            lines.append(f"{pad}[key: string]: {self._type(extra, owner, depth + 1)};")
        if not lines:
            return "Record<string, never>"
        body = "\n".join(lines)
        return "{\n" + body + "\n" + closing + "}"


HEADER = """// Generated by scripts/generate_ts_client.py from schemas/v1. Do not edit.
// Regenerate with: python3 scripts/generate_ts_client.py
"""


def build_types() -> tuple[str, dict[str, str]]:
    emitter = Emitter()
    names: dict[str, str] = {}
    for stem in sorted({s for row in ENDPOINTS for s in row[3:5] if s}):
        names[stem] = emitter.add_schema(SCHEMAS / f"{stem}.schema.json")
    return HEADER + "\n" + "\n\n".join(emitter.blocks) + "\n", names


def build_client(names: dict[str, str]) -> str:
    methods = []
    imports = sorted(set(names.values()))
    for method, _verb, path, request_stem, response_stem, summary in ENDPOINTS:
        request_type = names[request_stem] if request_stem else "JsonObject"
        response_type = names[response_stem] if response_stem else "JsonObject"
        methods.append(f"""  /** {summary} */
  {method}(request: {request_type}, options?: CallOptions): Promise<{response_type}> {{
    return this.post<{response_type}>({json.dumps(path)}, request, options);
  }}""")
    return HEADER + f"""
import type {{
{chr(10).join(f'  {name},' for name in imports)}
}} from "./types.js";

export type JsonObject = Record<string, unknown>;

export interface ClientOptions {{
  /** Base URL of the Agenda Intelligence HTTP shell, without a trailing slash. */
  baseUrl: string;
  /** Bearer secret issued by the operator. Omit only against an open dev instance. */
  apiKey?: string;
  /** Milliseconds before a call is abandoned. Default 30000. */
  timeoutMs?: number;
  /** Injected for tests and for runtimes without a global fetch. */
  fetch?: typeof fetch;
}}

export interface CallOptions {{
  /** Correlation id echoed back on the response and in the operator's logs. */
  requestId?: string;
  signal?: AbortSignal;
}}

/** Any non-2xx answer. `body` is the shell's JSON error when it sent one. */
export class AgendaIntelligenceError extends Error {{
  readonly status: number;
  readonly requestId: string | null;
  readonly body: JsonObject | null;

  constructor(message: string, status: number, requestId: string | null, body: JsonObject | null) {{
    super(message);
    this.name = "AgendaIntelligenceError";
    this.status = status;
    this.requestId = requestId;
    this.body = body;
  }}
}}

/** 429. Wait `retryAfterSeconds` before the next call rather than retrying at once. */
export class RateLimitError extends AgendaIntelligenceError {{
  readonly retryAfterSeconds: number;
  readonly limitPerMinute: number | null;

  constructor(
    message: string,
    requestId: string | null,
    body: JsonObject | null,
    retryAfterSeconds: number,
    limitPerMinute: number | null,
  ) {{
    super(message, 429, requestId, body);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.limitPerMinute = limitPerMinute;
  }}
}}

export class AgendaIntelligenceClient {{
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {{
    this.baseUrl = options.baseUrl.replace(/\\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30000;
    const impl = options.fetch ?? globalThis.fetch;
    if (!impl) {{
      throw new Error("No fetch available; pass one in ClientOptions.fetch");
    }}
    this.fetchImpl = impl;
  }}

  /** Liveness. Answers without a key, so it distinguishes 'starting' from 'broken'. */
  health(options?: CallOptions): Promise<JsonObject> {{
    return this.get<JsonObject>("/healthz", options);
  }}

  /** Readiness, including the access policy this instance is enforcing. */
  ready(options?: CallOptions): Promise<JsonObject> {{
    return this.get<JsonObject>("/readyz", options);
  }}

{chr(10).join(methods)}

  private get<T>(path: string, options?: CallOptions): Promise<T> {{
    return this.request<T>("GET", path, undefined, options);
  }}

  private post<T>(path: string, body: unknown, options?: CallOptions): Promise<T> {{
    return this.request<T>("POST", path, body, options);
  }}

  private async request<T>(method: string, path: string, body: unknown, options?: CallOptions): Promise<T> {{
    const headers: Record<string, string> = {{ accept: "application/json" }};
    if (this.apiKey) headers.authorization = `Bearer ${{this.apiKey}}`;
    if (options?.requestId) headers["x-request-id"] = options.requestId;
    if (body !== undefined) headers["content-type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    options?.signal?.addEventListener("abort", () => controller.abort(), {{ once: true }});

    const init: RequestInit = {{ method, headers, signal: controller.signal }};
    if (body !== undefined) init.body = JSON.stringify(body);

    let response: Response;
    try {{
      response = await this.fetchImpl(this.baseUrl + path, init);
    }} finally {{
      clearTimeout(timer);
    }}

    const requestId = response.headers.get("x-request-id");
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {{
      try {{
        parsed = JSON.parse(text);
      }} catch {{
        throw new AgendaIntelligenceError("Response was not JSON", response.status, requestId, null);
      }}
    }}
    const payload = (parsed ?? null) as JsonObject | null;

    if (response.status === 429) {{
      const header = Number(response.headers.get("retry-after"));
      const fromBody = typeof payload?.retry_after_seconds === "number" ? payload.retry_after_seconds : null;
      const limit = typeof payload?.limit_per_minute === "number" ? payload.limit_per_minute : null;
      throw new RateLimitError("Rate limit exceeded", requestId, payload, header || fromBody || 60, limit);
    }}
    if (!response.ok) {{
      const message = typeof payload?.error === "string" ? payload.error : `Request failed with ${{response.status}}`;
      throw new AgendaIntelligenceError(message, response.status, requestId, payload);
    }}
    return payload as T;
  }}
}}
"""


def build_package(version: str) -> str:
    return (
        json.dumps(
            {
                "name": "@agenda-intelligence/client",
                "version": version,
                "description": (
                    "TypeScript client for the Agenda Intelligence MD HTTP shell, generated from schemas/v1."
                ),
                "license": "MIT",
                "type": "module",
                "main": "dist/index.js",
                "types": "dist/index.d.ts",
                "files": ["dist", "src", "README.md"],
                "scripts": {"build": "tsc -p tsconfig.json"},
                "repository": {
                    "type": "git",
                    "url": "git+https://github.com/vassiliylakhonin/agenda-intelligence-md.git",
                    "directory": "clients/typescript",
                },
                "devDependencies": {"typescript": "^5.4.0"},
            },
            indent=2,
        )
        + "\n"
    )


TSCONFIG = """{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2022", "DOM"],
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
"""

INDEX = HEADER + '\nexport * from "./client.js";\nexport * from "./types.js";\n'


def readme(version: str) -> str:
    return f"""# @agenda-intelligence/client

TypeScript client for the Agenda Intelligence MD HTTP shell. Types are generated
from `schemas/v1`, so they cannot drift from the contract: CI regenerates and
compares.

Pinned to package version `{version}`.

```ts
import {{ AgendaIntelligenceClient, RateLimitError }} from "@agenda-intelligence/client";

const client = new AgendaIntelligenceClient({{
  baseUrl: "https://checks.internal.example.com",
  apiKey: process.env.AGENDA_INTELLIGENCE_KEY,
}});

try {{
  const result = await client.preActionCheck(request, {{ requestId: correlationId }});
  console.log(result.decision);
}} catch (error) {{
  if (error instanceof RateLimitError) {{
    // Wait, do not retry immediately.
    await sleep(error.retryAfterSeconds * 1000);
  }}
  throw error;
}}
```

Every call throws `AgendaIntelligenceError` on a non-2xx answer, carrying the
status, the `x-request-id` the shell echoed, and the parsed error body. `429`
throws the `RateLimitError` subclass with `retryAfterSeconds`.

`health()` and `ready()` answer without a key. `ready()` reports the access
policy the instance is enforcing, which is the fastest way to tell a
misconfigured deployment from a rejected key.

Do not edit `src/types.ts` or `src/client.ts`. Run
`python3 scripts/generate_ts_client.py` from the repository root.
"""


def render() -> dict[str, str]:
    version = json.loads((ROOT / "agent-manifest.json").read_text(encoding="utf-8")).get("version")
    if not version:
        raise RuntimeError("agent-manifest.json carries no version")
    types, names = build_types()
    return {
        "src/types.ts": types,
        "src/client.ts": build_client(names),
        "src/index.ts": INDEX,
        "package.json": build_package(version),
        "tsconfig.json": TSCONFIG,
        "README.md": readme(version),
    }


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    check = "--check" in args
    files = render()
    stale = []
    for relative, content in files.items():
        target = OUT / relative
        if check:
            if not target.exists() or target.read_text(encoding="utf-8") != content:
                stale.append(relative)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    if check:
        if stale:
            print("stale generated client files: " + ", ".join(sorted(stale)), file=sys.stderr)
            return 1
        print("ok: clients/typescript matches schemas/v1")
        return 0
    print(f"wrote {len(files)} files to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
