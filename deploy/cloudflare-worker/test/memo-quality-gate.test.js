import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';

const origin = 'https://example.test';
const env = {AGENT_PROFILE:'agenda', BILLING_MODE:'pay_per_call', X402_STANDARD:'1'};
const tool = 'strategic_risk_memo_quality_gate';
const request = (path, body, headers = {}) => new Request(origin + path, {method:'POST',
  headers:{'content-type':'application/json', ...headers}, body:JSON.stringify(body)});
const mcp = (args, headers) => request('/mcp/agent', {jsonrpc:'2.0',id:1,method:'tools/call',
  params:{name:tool,arguments:args}}, headers);
const a2a = part => request('/message/send', {jsonrpc:'2.0',id:1,method:'SendMessage',
  params:{message:{messageId:'synthetic-memo',role:'ROLE_USER',parts:[part]}}}, {'a2a-version':'1.0'});
const get = async (path, environment = env) => (await handleRequest(new Request(origin + path), environment)).json();

test('the advertised memo example runs on MCP and both A2A clients with zero payment', async () => {
  const card = await get('/.well-known/agent-card.json');
  const example = await get('/.well-known/examples/tools/' + tool + '.json');
  const skill = card.skills.find(item => item.id === 'agenda-validate-memo');
  const text = skill.examples.find(value => value.startsWith('{'));
  assert.deepEqual(JSON.parse(text), {tool,...example.arguments});
  const offer = (await get('/.well-known/x402')).offers.find(item => item.tool === tool);
  assert.equal(offer.price_usdc, 0);
  assert.equal(offer.payment_required, false);

  const response = await handleRequest(mcp(example.arguments), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.has('payment-required'), false);
  const expected = (await response.json()).result.structuredContent;
  assert.equal(expected.schema_valid, true);
  assert.equal(expected.route, 'revise');
  assert.deepEqual(expected.findings.map(item => item.code), ['missing_fact_source','missing_actions','vague_indicator']);
  assert.equal(expected.human_review_required, true);
  assert.equal(expected.evidence_verified, false);
  assert.equal(expected.authorization_granted, false);
  assert.equal(expected.payment_required, false);
  for (const part of [{data:JSON.parse(text),mediaType:'application/json'}, {text}]) {
    const a2aResponse = await handleRequest(a2a(part), env);
    assert.equal(a2aResponse.status, 200);
    const {task} = (await a2aResponse.json()).result;
    assert.equal(task.status.state, 'TASK_STATE_COMPLETED');
    assert.deepEqual(task.artifacts[0].parts[0].data, expected);
  }
});

test('the memo gate returns invalid fields or human review and is scoped to Agenda', async () => {
  const example = await get('/.well-known/examples/tools/' + tool + '.json');
  const args = example.arguments;
  args.memo_json.audit.provenance[0].source = 'Synthetic continuity plan, page 2';
  args.memo_json.recommended_actions = [{action:'Request the test record.',priority:'high',time_horizon:'Before circulation'}];
  args.memo_json.watch_next = [{indicator:'The supplier misses its test deadline.',trigger:'No report by Friday'}];
  const read = async input => (await (await handleRequest(mcp(input), env)).json()).result.structuredContent;
  const valid = await read(args);
  assert.equal(valid.route, 'human_review');
  assert.deepEqual(valid.findings, []);
  assert.equal(valid.human_review_required, true);
  const invalid = await read({memo_json:{}});
  assert.equal(invalid.schema_valid, false);
  assert.equal(invalid.route, 'revise');
  assert.ok(invalid.findings.some(item => item.path === '/memo_json' && item.code === 'schema_required' && item.message.includes("'meta'")));
  assert.equal((await handleRequest(mcp(args, {'payment-signature':'not-a-payment'}), env)).status, 400);

  const other = {...env, AGENT_PROFILE:'kazakhstan'};
  assert.equal((await get('/.well-known/agent-card.json', other)).skills.some(item => item.id === 'agenda-validate-memo'), false);
  assert.equal((await handleRequest(new Request(origin + '/.well-known/schemas/tools/' + tool + '.json'), other)).status, 404);
});
