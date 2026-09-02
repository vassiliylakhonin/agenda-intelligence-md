// Every request gets the same answer: this deployment is gone, and here is
// what replaced it. Callers here are agents and directory crawlers, so the
// body is JSON and the machine-readable signal lives in the headers.

const SUCCESSOR = "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev";
const DIRECTORY = "https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev";

// RFC 9745 wants an HTTP-date; the alias stopped being deployed on 2026-05-31.
const DEPRECATION = "@1780211683";
const SUNSET = "Sun, 31 May 2026 07:14:43 GMT";

const BODY = JSON.stringify(
  {
    error: "gone",
    message:
      "kazakhstan-corridor-risk-a2a was retired on 2026-05-31 and is not coming back. " +
      "Its profile is served by middle-corridor-deal-risk-gate-a2a.",
    successor: SUCCESSOR,
    agent_card: `${SUCCESSOR}/.well-known/agent-card.json`,
    directory: DIRECTORY
  },
  null,
  2
);

export default {
  fetch() {
    return new Response(BODY, {
      status: 410,
      headers: {
        "content-type": "application/json; charset=utf-8",
        deprecation: DEPRECATION,
        sunset: SUNSET,
        link: `<${SUCCESSOR}>; rel="successor-version", <${DIRECTORY}>; rel="index"`,
        // A tombstone is the one answer that will not change. Let every hop
        // between the crawler and here remember it.
        "cache-control": "public, max-age=86400, immutable"
      }
    });
  }
};
