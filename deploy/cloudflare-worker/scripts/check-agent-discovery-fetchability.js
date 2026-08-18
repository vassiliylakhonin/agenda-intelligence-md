const DEFAULT_BASE_URL = "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev";

const args = process.argv.slice(2);
const strictPython = args.includes("--strict-python");
const baseUrlArg = args.find((arg) => !arg.startsWith("--"));
const baseUrl = (baseUrlArg || DEFAULT_BASE_URL).replace(/\/+$/, "");

const paths = [
  "/.well-known/ai-catalog.json",
  "/.well-known/api-catalog",
  "/api/openapi.json",
  "/.well-known/mcp/server-card.json",
  "/.well-known/did.json",
  "/entitymap.json",
  "/okf/index.md",
  "/profiles/confidential-project-room",
  "/profiles/confidential-project-room/redacted-example.json",
  "/robots.txt"
];

const userAgents = [
  { label: "curl", value: "curl/8.0", required: true },
  { label: "browser-like", value: "Mozilla/5.0 AgentReadinessTest/1.0", required: true },
  { label: "OAI-SearchBot", value: "OAI-SearchBot", required: true },
  { label: "GPTBot", value: "GPTBot", required: true },
  { label: "Python urllib", value: "Python-urllib/3.9", required: strictPython },
  { label: "libwww-perl", value: "libwww-perl/6.72", required: false }
];

async function fetchWithUserAgent(url, userAgent) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "*/*"
    },
    signal: AbortSignal.timeout(20000)
  });
  const body = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    bodyPreview: body.slice(0, 120)
  };
}

let failures = 0;
let warnings = 0;

for (const path of paths) {
  const url = `${baseUrl}${path}`;
  console.log(`\n${url}`);
  for (const userAgent of userAgents) {
    try {
      const result = await fetchWithUserAgent(url, userAgent.value);
      const ok = result.status >= 200 && result.status < 300;
      const browserIntegrityBlock =
        result.status === 403 && result.bodyPreview.toLowerCase().includes("error code: 1010");

      if (ok) {
        console.log(`  OK   ${userAgent.label}: ${result.status} ${result.contentType}`);
        continue;
      }

      if (!userAgent.required && browserIntegrityBlock) {
        warnings += 1;
        console.log(
          `  WARN ${userAgent.label}: ${result.status} Cloudflare 1010 Browser Integrity block`
        );
        continue;
      }

      const level = userAgent.required ? "FAIL" : "WARN";
      console.log(`  ${level} ${userAgent.label}: ${result.status} ${result.bodyPreview}`);
      if (userAgent.required) failures += 1;
      else warnings += 1;
    } catch (error) {
      const level = userAgent.required ? "FAIL" : "WARN";
      console.log(`  ${level} ${userAgent.label}: ${error.message}`);
      if (userAgent.required) failures += 1;
      else warnings += 1;
    }
  }
}

if (warnings) {
  console.log(
    "\nWarnings are expected: Cloudflare blocks `Python-urllib/*` and `libwww-perl/*` by user-agent on *.workers.dev, before the Worker runs."
  );
  console.log(
    "Measured 2026-08-18: it is the user-agent string alone — curl sending a urllib user-agent is blocked, urllib sending a curl one is served, and a blocked request writes no Workers Logs event. Worker code cannot answer a request Cloudflare stops at the edge, and the skip rule that would lift it is a zone setting this account has no zone for. Removing it means a custom domain."
  );
}

if (failures) {
  console.error(`\nAgent discovery fetchability failed: ${failures} required checks failed.`);
  process.exit(1);
}

console.log("\nAgent discovery fetchability required checks passed.");
