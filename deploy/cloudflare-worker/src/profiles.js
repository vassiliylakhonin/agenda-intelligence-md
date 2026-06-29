import { OPENSANCTIONS_HOMEPAGE, OPENSANCTIONS_LICENSE } from "./upstream_opensanctions.js";
import { WATCHMAN_LICENSE, WATCHMAN_PROJECT_URL } from "./upstream_watchman.js";
import { SNAPSHOT_LICENSE, SNAPSHOT_PROJECT_URL } from "./upstream_snapshot.js";

export const SUPPORT_CONTACT_EMAIL = "vassiliy.lakhonin@gmail.com";
export const SUPPORT_HOURS_LOCAL = "Mon–Fri 09:00–18:00 Asia/Almaty (UTC+5)";
export const SUPPORT_TIMEZONE = "Asia/Almaty";

export const VERSION = "1.1.0";
export const REPOSITORY_URL = "https://github.com/vassiliylakhonin/agenda-intelligence-md";
export const DOCS_URL = `${REPOSITORY_URL}/blob/main/MCP.md`;
export const PACKAGE_URL = "https://pypi.org/project/agenda-intelligence-md/";
export const A2A_EXAMPLES_URL = `${REPOSITORY_URL}/tree/main/examples/a2a`;
export const OKF_BUNDLE_REPO_URL = `${REPOSITORY_URL}/blob/main/okf/index.md`;
export const SCHEMAS_URL = `${REPOSITORY_URL}/tree/main/schemas/v1`;
export const SOURCE_POLICY_URL = `${REPOSITORY_URL}/blob/main/SOURCE_POLICY.md`;
export const DISCOVERY_UPDATED_AT = "2026-06-29";

export const CONFIDENTIAL_PROJECT_ROOM_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/trust/confidential-project-workflow.md`;
export const CONFIDENTIAL_PROJECT_ROOM_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/confidential-project-room-profile.schema.json`;

export const MIDDLE_CORRIDOR_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/kazakhstan-middle-corridor.md`;
export const MIDDLE_CORRIDOR_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/middle-corridor-deal-risk-request.schema.json`;
export const MIDDLE_CORRIDOR_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/middle-corridor-deal-risk-response.schema.json`;
export const MIDDLE_CORRIDOR_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/middle-corridor-deal-risk.json`;

export const CIS_SECONDARY_SANCTIONS_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/cis-secondary-sanctions.md`;
export const CIS_SECONDARY_SANCTIONS_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/cis-secondary-sanctions-request.schema.json`;
export const CIS_SECONDARY_SANCTIONS_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/cis-secondary-sanctions-response.schema.json`;
export const CIS_SECONDARY_SANCTIONS_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/cis-secondary-sanctions.json`;
export const CIS_SECONDARY_SANCTIONS_ADR_URL = `${REPOSITORY_URL}/blob/main/docs/adr/0014-per-profile-live-retrieval.md`;

export const AGENTIC_INTERACTION_TRUST_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/agentic-interaction-trust.md`;
export const AGENTIC_INTERACTION_TRUST_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/agentic-interaction-trust-request.schema.json`;
export const AGENTIC_INTERACTION_TRUST_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/agentic-interaction-trust-response.schema.json`;
export const AGENTIC_INTERACTION_TRUST_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/agentic-interaction-trust.json`;

export const GULF_MARITIME_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/gulf-maritime-exposure.md`;
export const GULF_MARITIME_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/gulf-maritime-exposure-request.schema.json`;
export const GULF_MARITIME_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/gulf-maritime-exposure-response.schema.json`;
export const GULF_MARITIME_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/gulf-maritime-exposure.json`;

export const MARKET_ENTRY_DOCS_URL = `${REPOSITORY_URL}/blob/main/docs/use-cases/kazakhstan-market-entry-readiness.md`;
export const MARKET_ENTRY_REQUEST_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/market-entry-readiness-request.schema.json`;
export const MARKET_ENTRY_RESPONSE_SCHEMA_URL = `${REPOSITORY_URL}/blob/main/schemas/v1/market-entry-readiness-response.schema.json`;
export const MARKET_ENTRY_SOURCE_TAXONOMY_URL = `${REPOSITORY_URL}/blob/main/source-requirements/kazakhstan-market-entry-readiness.json`;

// Canonical input mode shared by per-profile product_contract blocks and the
// top-level x_agent_contract discoverability extension.
export const CANONICAL_INPUT_MODE = "structured_json";

// Versioned independently of the package/card VERSION: this is the
// discoverability contract surfaced to catalogs and agents, not a package
// release.
export const MIDDLE_CORRIDOR_AGENT_CONTRACT_VERSION = "1.0";

// Intent strings the Middle Corridor endpoint can actually emit. Mirrors
// classifyIntent / classifyIntentForProfile / triageForText; verify-agent-card.js
// asserts the primary intent so this list cannot silently drift from routing.
export const MIDDLE_CORRIDOR_SUPPORTED_INTENTS = [
  "middle_corridor_deal_risk_contract",
  "deal_risk_gate",
  "sanctions_policy_signal_screen",
  "source_coverage",
  "evidence_audit",
  "memo_validation",
  "signal_monitoring",
  "strategic_risk_triage"
];

// Per-profile live retrieval CAPABILITY declarations. Actual runtime activation
// is env-derived in index.js via activeUpstreamOption / isLiveRetrievalActive.
export const PROFILE_LIVE_RETRIEVAL = {
  agenda: { capability_declared: false, upstream_options: [] },
  kazakhstan: { capability_declared: false, upstream_options: [] },
  agentic_interaction_trust: { capability_declared: false, upstream_options: [] },
  gulf_maritime_exposure: { capability_declared: false, upstream_options: [] },
  cis_secondary_sanctions: {
    capability_declared: true,
    upstream_options: [
      {
        name: "Snapshot",
        license: SNAPSHOT_LICENSE,
        homepage: SNAPSHOT_PROJECT_URL,
        activation_env_var: "SNAPSHOT_INDEX_URL",
        disable_env_var: "SNAPSHOT_DISABLED",
        cost_model: "static public-list snapshot fetched by the worker; $0, no external host"
      },
      {
        name: "Watchman",
        license: WATCHMAN_LICENSE,
        homepage: WATCHMAN_PROJECT_URL,
        activation_env_var: "WATCHMAN_URL",
        disable_env_var: "WATCHMAN_DISABLED",
        cost_model: "self-hosted (Apache-2.0); $0/month on free-tier container"
      },
      {
        name: "OpenSanctions",
        license: OPENSANCTIONS_LICENSE,
        homepage: OPENSANCTIONS_HOMEPAGE,
        activation_env_var: "OPENSANCTIONS_API_KEY",
        disable_env_var: "OPENSANCTIONS_DISABLED",
        cost_model: "paid €0.10/call (30-day business-email trial)"
      }
    ]
  }
};
