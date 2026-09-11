import test from "node:test";
import assert from "node:assert/strict";
import {
  screenMaritimeExposureWithVizier,
  isMaritimeVizierEnabled,
  maritimeAttributionBlock
} from "../src/upstream_vizier_maritime.js";
import { handleRequest } from "../src/index.js";

test("upstream_vizier_maritime: isMaritimeVizierEnabled accurately detects configuration", () => {
  assert.equal(isMaritimeVizierEnabled({}), false);
  assert.equal(isMaritimeVizierEnabled({ VIZIER_DISABLED: "1" }), false);
  assert.equal(isMaritimeVizierEnabled({ VIZIER_DISABLED: "true" }), false);
  assert.equal(isMaritimeVizierEnabled({ VIZIER: {} }), true);
  assert.equal(isMaritimeVizierEnabled({ VIZIER_ENABLED: "1" }), true);
  assert.equal(isMaritimeVizierEnabled({ VIZIER_BASE_URL: "https://example.com" }), true);
  assert.equal(isMaritimeVizierEnabled({ VIZIER_API_KEY: "vz_live_123" }), true);
});

test("upstream_vizier_maritime: maritimeAttributionBlock returns proper notice", () => {
  const attr = maritimeAttributionBlock();
  assert.equal(attr.upstream, "Vizier Maritime Firewall");
  assert.ok(attr.url.includes("vizier.vassiliy-lakhonin.workers.dev"));
  assert.ok(attr.notice.includes("Vizier Action Firewall"));
});

test("upstream_vizier_maritime: screens vessel and counterparties and flags violations", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFwcGxpY2F0aW9uL3Zpemllci1yZWNlaXB0K2p3dCJ9.test.sig";
  const mockEnv = {
    VIZIER: {
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        if (body.entity_name.includes("National Iranian Tanker")) {
          return new Response(
            JSON.stringify({
              entity_name: body.entity_name,
              clean: false,
              violation: true,
              aggregate_blocked_percentage: 100,
              blocked_shareholders: [{ name: body.entity_name, direct_percentage: 100 }],
              reason_codes: ["SANCTIONED_ENTITY_MATCH"],
              explanation: "Target entity is blocked on OFAC SDN.",
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            entity_name: body.entity_name,
            clean: true,
            violation: false,
            aggregate_blocked_percentage: 0,
            blocked_shareholders: [],
            reason_codes: [],
            receipt: fakeJws
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  };

  const req = {
    vessel: { name: "Gulf Star Tanker", imo: "9123456", flag: "PA" },
    counterparties: [
      { name: "National Iranian Tanker Company", role: "registered_owner" },
      { name: "Legitimate Ship Management Ltd", role: "manager" }
    ]
  };

  const res = await screenMaritimeExposureWithVizier(mockEnv, req);
  assert.equal(res.status, "success");
  assert.equal(res.violation, true);
  assert.equal(res.clean, false);
  assert.equal(res.matches.length, 1);
  assert.equal(res.matches[0].name, "National Iranian Tanker Company");
  assert.equal(res.matches[0].role, "registered_owner");
  assert.equal(res.receipt, fakeJws);
});

test("upstream_vizier_maritime: gracefully degrades on upstream error", async () => {
  const mockEnv = {
    VIZIER: {
      fetch: async () => {
        return new Response("Internal Error", { status: 500 });
      }
    }
  };

  const req = {
    vessel: { name: "Gulf Star Tanker", imo: "9123456" }
  };

  const res = await screenMaritimeExposureWithVizier(mockEnv, req);
  assert.equal(res.status, "degraded");
  assert.equal(res.violation, false);
  assert.equal(res.clean, false);
  assert.ok(res.degrade_reason.includes("500"));
});

test("e2e: gulf_maritime_exposure elevates exposure signal and attaches Vizier receipt in metadata", async () => {
  const fakeJws = "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.test.sig";
  const mockEnv = {
    AGENT_PROFILE: "gulf_maritime_exposure",
    VIZIER: {
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        if (body.entity_name.includes("National Iranian Tanker")) {
          return new Response(
            JSON.stringify({
              entity_name: body.entity_name,
              clean: false,
              violation: true,
              aggregate_blocked_percentage: 100,
              blocked_shareholders: [{ name: body.entity_name, direct_percentage: 100 }],
              reason_codes: ["SANCTIONED_ENTITY_MATCH"],
              receipt: fakeJws
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            entity_name: body.entity_name,
            clean: true,
            violation: false,
            receipt: fakeJws
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  };

  const payload = {
    jsonrpc: "2.0",
    id: "gulf-e2e-01",
    method: "message/send",
    params: {
      capability: "gulf_maritime_exposure",
      request: {
        vessel: { name: "Sea Horizon", flag: "PA" },
        voyage: { chokepoint: "strait_of_hormuz" },
        exposure_facets: ["iran_oil_exposure"],
        counterparties: [
          { name: "National Iranian Tanker Company", role: "registered_owner" }
        ],
        dated_sources: [
          { id: "s1", source_type: "vessel_registry_extract", title: "Extract", date: "2026-09-01" },
          { id: "s2", source_type: "flag_registry_record", title: "Flag", date: "2026-09-02" }
        ],
        risk_question: "Can we fixture this vessel for Persian Gulf lifting?",
        decision_stage: "pre_fixture"
      }
    }
  };

  const httpRequest = new Request("https://gulf-maritime-exposure-a2a.example.workers.dev/message/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const response = await handleRequest(httpRequest, mockEnv);
  assert.equal(response.status, 200);
  const data = await response.json();

  const metadata = data.result.metadata;
  assert.equal(metadata.vizier_status, "success");
  assert.equal(metadata.vizier_clearance_receipt, fakeJws);
  assert.equal(metadata.maritime_screening.violation, true);

  const responseBody = metadata.response;
  assert.equal(responseBody.exposure_signal, "high");
  assert.equal(responseBody.triage_recommendation, "escalate_before_fixture");
  assert.ok(
    responseBody.top_exposure_dimensions.some((d) => d.includes("National Iranian Tanker Company"))
  );
});
