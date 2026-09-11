import test from "node:test";
import assert from "node:assert/strict";

import { handleJsonRpc } from "../src/index.js";
import {
  attributionBlock,
  isEnabled,
  screenBeneficialOwnershipWithVizier
} from "../src/upstream_vizier.js";

const cisRequest = new Request(
  "https://cis-secondary-sanctions-a2a.example.workers.dev/message/send",
  { method: "POST" }
);

test("upstream_vizier: isEnabled accurately detects Service Binding and configuration", () => {
  assert.equal(isEnabled({}), false);
  assert.equal(isEnabled({ VIZIER_DISABLED: "1", VIZIER_ENABLED: "1" }), false);
  assert.equal(isEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isEnabled({ VIZIER: { fetch: async () => {} } }), true);
  assert.equal(isEnabled({ VIZIER_BASE_URL: "https://vizier.example" }), true);
  assert.equal(isEnabled({ VIZIER_API_KEY: "vz_live_test123" }), true);
});

test("upstream_vizier: attributionBlock surfaces Vizier notice", () => {
  const block = attributionBlock();
  assert.equal(block.upstream, "Vizier");
  assert.ok(block.url.includes("vizier"));
  assert.ok(block.notice.includes("JWS"));
});

test("upstream_vizier: screens entity via Service Binding and returns 50% rule violation", async () => {
  const mockService = {
    fetch: async (url, init) => {
      assert.equal(url, "https://vizier.internal/v1/sanctions/screen-entity");
      assert.equal(init.method, "POST");
      const body = JSON.parse(init.body);
      assert.equal(body.entity_name, "Eurasia Import Export LLP");
      assert.equal(body.shareholders.length, 2);

      return new Response(
        JSON.stringify({
          entity_name: "Eurasia Import Export LLP",
          violation: true,
          clean: false,
          aggregate_blocked_percentage: 55.0,
          threshold_percentage: 50.0,
          blocked_shareholders: [
            {
              name: "Garantex Europe",
              direct_percentage: 35.0,
              effective_percentage: 35.0,
              list: "OFAC_SDN",
              path: ["Eurasia Import Export LLP", "Garantex Europe"]
            },
            {
              name: "Tornado Cash",
              direct_percentage: 20.0,
              effective_percentage: 20.0,
              list: "OFAC_SDN",
              path: ["Eurasia Import Export LLP", "Tornado Cash"]
            }
          ],
          reason_codes: ["SANCTIONS_50_RULE_VIOLATION"],
          explanation: "Entity is blocked under OFAC 50% Rule: 55% blocked ownership.",
          receipt: {
            id: "vrf_mock_receipt_123",
            jws: "eyJhbGciOiJFUzI1NiJ9..."
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  const env = {
    VIZIER: mockService,
    VIZIER_API_KEY: "vz_live_mock_key"
  };

  const result = await screenBeneficialOwnershipWithVizier(env, {
    counterparty: { name: "Eurasia Import Export LLP", jurisdiction: "Kazakhstan" },
    shareholders: [
      { name: "Garantex Europe", percentage: 35.0 },
      { name: "Tornado Cash", percentage: 20.0 }
    ]
  });

  assert.equal(result.status, "success");
  assert.equal(result.violation, true);
  assert.equal(result.clean, false);
  assert.equal(result.aggregate_blocked_percentage, 55.0);
  assert.equal(result.blocked_shareholders.length, 2);
  assert.equal(result.matches.length, 2);
  assert.equal(result.receipt.id, "vrf_mock_receipt_123");
  assert.ok(result.explanation.includes("55%"));
});

test("upstream_vizier: gracefully degrades on network or server failure without throwing", async () => {
  const failingService = {
    fetch: async () => {
      throw new Error("Connection reset by peer");
    }
  };

  const env = { VIZIER: failingService };
  const result = await screenBeneficialOwnershipWithVizier(env, {
    counterparty: { name: "Test Corp", jurisdiction: "Kazakhstan" }
  });

  assert.equal(result.status, "degraded");
  assert.equal(result.violation, false);
  assert.equal(result.clean, false);
  assert.ok(result.degrade_reason.includes("Connection reset"));
});

test("e2e: cis_secondary_sanctions elevates exposure signal and attaches Vizier 50% rule JWS receipt", async () => {
  const mockVizierService = {
    fetch: async () => {
      return new Response(
        JSON.stringify({
          entity_name: "Caspian Trade Consortium",
          violation: true,
          clean: false,
          aggregate_blocked_percentage: 55.0,
          threshold_percentage: 50.0,
          blocked_shareholders: [
            {
              name: "Garantex Europe",
              direct_percentage: 35.0,
              effective_percentage: 35.0,
              list: "OFAC_SDN",
              path: ["Caspian Trade Consortium", "Garantex Europe"]
            },
            {
              name: "Tornado Cash",
              direct_percentage: 20.0,
              effective_percentage: 20.0,
              list: "OFAC_SDN",
              path: ["Caspian Trade Consortium", "Tornado Cash"]
            }
          ],
          reason_codes: ["SANCTIONS_50_RULE_VIOLATION"],
          explanation: "Entity is deemed blocked under OFAC 50% Rule: 55% aggregate blocked ownership.",
          receipt: {
            id: "vrf_jws_receipt_caspian_50",
            jws: "eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJ2aXppZXIifQ.signature"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  const env = {
    AGENT_PROFILE: "cis_secondary_sanctions",
    VIZIER: mockVizierService,
    SNAPSHOT_DISABLED: "1"
  };

  const requestPayload = {
    counterparty: {
      name: "Caspian Trade Consortium",
      jurisdiction: "Kazakhstan",
      sector: "trading_house"
    },
    shareholders: [
      { name: "Garantex Europe", percentage: 35.0 },
      { name: "Tornado Cash", percentage: 20.0 },
      { name: "Clean Partner", percentage: 45.0 }
    ],
    exposure_facets: ["ownership_or_control"],
    dated_sources: [
      { id: "s1", source_type: "ownership_chain_evidence", title: "Corporate Registry", date: "2026-09-01" }
    ],
    risk_question: "Check compliance under OFAC 50% Rule",
    decision_stage: "pre_transaction"
  };

  const rpcResponse = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: "test-vizier-50-rule",
      method: "message/send",
      params: { message: { data: requestPayload } }
    },
    cisRequest,
    env
  );

  assert.equal(rpcResponse.jsonrpc, "2.0");
  assert.equal(rpcResponse.id, "test-vizier-50-rule");

  const metadata = rpcResponse.result.metadata;
  assert.equal(metadata.vizier_status, "success");
  assert.equal(metadata.vizier_clearance_receipt, "vrf_jws_receipt_caspian_50");

  const resp = metadata.response;
  assert.equal(resp.secondary_exposure_signal, "high");
  assert.equal(resp.triage_recommendation, "escalate_before_transaction");
  assert.ok(
    resp.top_exposure_dimensions.some((d) => d.includes("OFAC 50% Rule deemed-blocked")),
    "Top exposure dimensions should include OFAC 50% Rule deemed-blocked note"
  );
  assert.ok(resp.beneficial_ownership_clearance);
  assert.equal(resp.beneficial_ownership_clearance.violation, true);
  assert.equal(resp.beneficial_ownership_clearance.aggregate_blocked_percentage, 55.0);
  assert.equal(resp.beneficial_ownership_clearance.receipt.id, "vrf_jws_receipt_caspian_50");
});
