"""Validate real Worker MCP results with a full Draft 2020-12 validator."""

import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator


def test_compact_answer_review_has_valid_contract_and_invalid_input_consumes_no_attempt():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker protocol tests need Node.js")
    root = Path(__file__).resolve().parents[1]
    program = """
      import {handleRequest} from './deploy/cloudflare-worker/src/index.js';
      import {memoryD1} from './deploy/cloudflare-worker/test/helpers/d1.js';
      const log=console.log;console.log=()=>{};
      const env={AGENT_PROFILE:'agent_output_verification',WORKER_FREE_TRIAL:'1',
        BILLING_MODE:'pay_per_call',PAYMENT_LEDGER:memoryD1()};
      const call=async(method,params)=>{
        const response=await handleRequest(new Request('https://example.test/mcp/output-verification',{
          method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},
          body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),env);
        return response.json();
      };
      const input={answer:'The report mentions "three warehouses" [s1]',
        sources:[{source_id:'s1',text:'The report lists three warehouses.'}]};
      const listed=await call('tools/list',{});
      const spec=listed.result.tools.find(t=>t.name==='review_answer');
      const valid=await call('tools/call',{name:'review_answer',arguments:input});
      const invalid=await call('tools/call',{name:'review_answer',arguments:{answer:'Missing sources'}});
      const count=await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS count FROM output_verification_trials').first();
      log(JSON.stringify({spec,input,valid,invalid,count}));
    """
    run = subprocess.run(
        [node, "--input-type=module", "-e", program], cwd=root, check=True, capture_output=True, text=True, timeout=30
    )
    result = json.loads(run.stdout)
    Draft202012Validator(result["spec"]["inputSchema"]).validate(result["input"])
    payload = result["valid"]["result"]["structuredContent"]
    Draft202012Validator(result["spec"]["outputSchema"]).validate(payload)
    assert payload["evaluation"]["route"] == "human_review"
    assert payload["evaluation"]["semantic_support"] == "not_assessed"
    assert json.loads(result["valid"]["result"]["content"][0]["text"]) == payload
    assert result["invalid"]["result"]["isError"] is True
    assert result["count"]["count"] == 1


def test_fleet_trials_validate_examples_and_responses_and_refuse_empty_input():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker protocol tests need Node.js")
    root = Path(__file__).resolve().parents[1]
    program = """
      import { handleRequest } from './deploy/cloudflare-worker/src/index.js';
      import { mcpToolsForProfile } from './deploy/cloudflare-worker/src/mcp.js';
      import { TRIAL_PROFILES } from './deploy/cloudflare-worker/src/trial-profiles.js';
      import { memoryD1 } from './deploy/cloudflare-worker/test/helpers/d1.js';
      const log = console.log; console.log = () => {};
      const results = [];
      for (const [profile, config] of Object.entries(TRIAL_PROFILES)) {
        const env = { AGENT_PROFILE:profile, WORKER_FREE_TRIAL:'1',
          BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1', PAYMENT_LEDGER:memoryD1() };
        const terms = await (await handleRequest(new Request('https://example.test/v1/trial'),env)).json();
        const call = body => handleRequest(new Request('https://example.test/v1/trial',
          {method:'POST',headers:{'cf-connecting-ip':'192.0.2.4'},body:JSON.stringify(body)}),env);
        const valid = await call(terms.example_request);
        const invalid = await call({});
        results.push({profile,terms,valid_status:valid.status,payload:await valid.json(),
          schema:mcpToolsForProfile(profile).find(t=>t.name===config.tool).outputSchema,
          invalid_status:invalid.status,invalid:await invalid.json(),
          reservations:await env.PAYMENT_LEDGER.prepare(
            'SELECT COUNT(*) AS count FROM output_verification_trials').first(),
          completion_receipts:await env.PAYMENT_LEDGER.prepare(
            'SELECT COUNT(*) AS count FROM trial_completion_receipts').first()});
      }
      log(JSON.stringify(results));
    """
    run = subprocess.run(
        [node, "--input-type=module", "-e", program],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    results = json.loads(run.stdout)
    assert len(results) == 12
    for result in results:
        assert result["valid_status"] == 200, result["profile"]
        terms = result["terms"]
        Draft202012Validator(terms["input_schema"]).validate(terms["example_request"])
        schema = copy.deepcopy(result["schema"])
        if terms.get("request_schema"):
            response_path = terms["request_schema"].lstrip("/").replace("-request.schema", "-response.schema")
            response_path = response_path.replace("evidence-audit.schema", "agent-output-verification-response.schema")
            schema = json.loads((root / response_path).read_text())
        schema["additionalProperties"] = True  # REST provenance and additive trial terms.
        Draft202012Validator(schema).validate(result["payload"])
        assert result["payload"]["next_action"] in {"block", "review", "insufficient"}
        assert result["payload"]["authorization_granted"] is False
        assert result["payload"]["trial"]["payment_required"] is False
        assert result["payload"]["trial"]["completion_recorded"] is True
        assert result["payload"]["trial"]["agent_profile"] == result["profile"]
        assert result["invalid_status"] == 400
        assert result["invalid"]["code"] == "invalid_trial_request"
        assert result["reservations"]["count"] == 1
        assert result["completion_receipts"]["count"] == 1


def test_output_verification_trial_keeps_the_response_contract_and_invalid_input_free():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker protocol tests need Node.js")
    root = Path(__file__).resolve().parents[1]
    program = """
      import { handleRequest } from './deploy/cloudflare-worker/src/index.js';
      import { memoryD1 } from './deploy/cloudflare-worker/test/helpers/d1.js';
      const log = console.log; console.log = () => {};
      const env = { AGENT_PROFILE:'agent_output_verification', OUTPUT_VERIFICATION_TRIAL:'1',
        BILLING_MODE:'pay_per_call', VIZIER_DISABLED:'1', PAYMENT_LEDGER:memoryD1() };
      const call = body => handleRequest(new Request('https://example.test/v1/agent-output/trial',
        {method:'POST',headers:{'cf-connecting-ip':'192.0.2.4'},body:JSON.stringify(body)}),env);
      const valid = await call({claims:[{claim_id:'c1',claim:'Supplied excerpt describes a warehouse.',
        support_level:'unsupported',evidence_ids:[]}],evidence:[]});
      const invalid = await call({});
      log(JSON.stringify({valid_status:valid.status,valid:await valid.json(),
        invalid_status:invalid.status,invalid:await invalid.json(),
        reservations:await env.PAYMENT_LEDGER.prepare(
          'SELECT COUNT(*) AS count FROM output_verification_trials').first()}));
    """
    run = subprocess.run(
        [node, "--input-type=module", "-e", program],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    result = json.loads(run.stdout)
    schema = json.loads((root / "schemas/v1/agent-output-verification-response.schema.json").read_text())
    schema["additionalProperties"] = True  # REST includes provenance and the additive trial object.
    assert result["valid_status"] == 200
    Draft202012Validator(schema).validate(result["valid"])
    assert result["valid"]["human_review_required"] is True
    assert result["valid"]["trial"]["payment_required"] is False
    assert result["invalid_status"] == 400
    assert result["invalid"]["code"] == "invalid_trial_request"
    assert result["reservations"]["count"] == 1


def test_worker_tools_conform_to_published_output_schemas():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker protocol tests need Node.js")
    root = Path(__file__).resolve().parents[1]
    run = subprocess.run(
        [node, "deploy/cloudflare-worker/scripts/check-runtime-contracts.js"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    responses = json.loads(run.stdout)
    assert len(responses) >= 23
    new_tools = {
        "agent_financial_pre_sign_check",
        "m2m_escrow_arbitration_ruling",
        "strategic_risk_triage",
        "corridor_sanctions_assistant",
        "fleet_directory",
    }
    assert new_tools <= {item["tool"] for item in responses if item["isError"] is False}
    assert sum(response["isError"] is False for response in responses) >= 8
    for response in responses:
        payload = response["payload"]
        if response["isError"] and (
            payload.get("error") or payload.get("status", {}).get("state") == "TASK_STATE_INPUT_REQUIRED"
        ):
            if not payload.get("error"):
                assert payload["metadata"].get("errors")
                continue
            assert response["payload"]["error"] in {"INVALID_TOOL_INPUT", "INPUT_REQUIRED"}
            continue
        Draft202012Validator(response["schema"]).validate(response["payload"])

        if response["tool"] in new_tools and response["isError"] is False:
            # Deleting the service result or changing a required typed field must
            # fail: the catalog is a useful contract, not an unconstrained object.
            broken = copy.deepcopy(payload)
            if "metadata" in broken:
                broken["metadata"]["response"] = {}
            elif response["tool"] == "fleet_directory":
                broken["gates"] = "not-a-directory"
            elif response["tool"] == "strategic_risk_triage":
                broken["signal_screen"] = {}
            else:
                broken["human_review_required"] = False
            assert list(Draft202012Validator(response["schema"]).iter_errors(broken))


def test_hosted_schema_preflight_contract_and_invalid_input_do_not_evaluate():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker protocol tests need Node.js")
    root = Path(__file__).resolve().parents[1]
    program = """
      import {handleRequest} from './deploy/cloudflare-worker/src/index.js';
      import {TRIAL_PROFILES} from './deploy/cloudflare-worker/src/trial-profiles.js';
      import {memoryD1} from './deploy/cloudflare-worker/test/helpers/d1.js';
      const log=console.log;console.log=()=>{};
      const results=[];
      for(const profile of Object.keys(TRIAL_PROFILES)) {
        const env={AGENT_PROFILE:profile,BILLING_MODE:'pay_per_call',WORKER_FREE_TRIAL:'1',
          OUTPUT_VERIFICATION_TRIAL:'1',PAYMENT_LEDGER:memoryD1()};
        const discover=new Request('https://example.test/.well-known/agent-contract.json');
        const contract=await(await handleRequest(discover,env)).json();
        const rows=[];
        for(const offer of contract.offers) {
          const example=await(await handleRequest(new Request(offer.example_url),env)).json();
          const schema=await(await handleRequest(new Request(offer.input_schema_url),env)).json();
          if(!example.example_available) continue;
          const payload={tool:offer.tool,input:example.arguments};
          const response=await handleRequest(new Request(contract.validation.http_endpoint,
            {method:'POST',body:JSON.stringify(payload)}),env);
          rows.push({schema,payload,status:response.status,result:await response.json()});
        }
        const bad=await handleRequest(new Request(contract.validation.http_endpoint,
          {method:'POST',body:JSON.stringify({tool:TRIAL_PROFILES[profile].tool,
            input:['agenda','corridor_sanctions_assistant'].includes(profile)?{text:42}:{}})}),env);
        results.push({profile,rows,bad:await bad.json(),
          reservations:await env.PAYMENT_LEDGER.prepare(
            'SELECT COUNT(*) AS n FROM output_verification_trials').first()});
      }
      const fleet=await(await handleRequest(new Request('https://example.test/.well-known/fleet.json'),{})).json();
      log(JSON.stringify({results,fleet}));
    """
    run = subprocess.run(
        [node, "--input-type=module", "-e", program], cwd=root, check=True, capture_output=True, text=True, timeout=30
    )
    result = json.loads(run.stdout)
    response_schema = json.loads((root / "schemas/v1/input-validation-response.schema.json").read_text())
    request_schema = json.loads((root / "schemas/v1/input-validation-request.schema.json").read_text())
    fleet_schema = json.loads((root / "schemas/v1/fleet-directory-response.schema.json").read_text())
    Draft202012Validator(fleet_schema).validate(result["fleet"])
    assert len(result["results"]) == 12
    for profile in result["results"]:
        assert profile["rows"], profile["profile"]
        for row in profile["rows"]:
            assert row["status"] == 200, (profile["profile"], row)
            Draft202012Validator(request_schema).validate(row["payload"])
            Draft202012Validator(row["schema"]).validate(row["payload"]["input"])
            Draft202012Validator(response_schema).validate(row["result"])
            assert row["result"]["valid"] is True, (profile["profile"], row)
            assert row["result"]["attempt_consumed"] is False
        Draft202012Validator(response_schema).validate(profile["bad"])
        assert profile["bad"]["valid"] is False
        assert profile["bad"]["findings"]
        assert profile["reservations"]["n"] == 0
