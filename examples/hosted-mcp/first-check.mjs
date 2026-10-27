/** Node 20+, no packages. One explicitly submitted free check; never pays or retries. */
const VERSION = '2025-11-25';
const REVISIONS = [VERSION, '2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_BYTES = 2 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));

export class FirstCheckError extends Error {
  constructor(code, message, {stage, status = null, connection = null} = {}) {
    super(message);
    this.name = 'FirstCheckError';
    this.code = code;
    this.stage = stage;
    this.status = status;
    this.connection = connection;
  }
}

function connectionHint(value) {
  if (!object(value)) return null;
  const reasons = ['accept_mismatch', 'invalid_request', 'invalid_json', 'header_mismatch',
    'unsupported_version', 'profile_method_mismatch', 'method_not_found', 'origin_rejected',
    'body_too_large', 'content_type_mismatch'];
  return {
    reason: reasons.includes(value.reason) ? value.reason : 'unmeasured',
    recommended_profile: ['session', 'stateless'].includes(value.recommended_profile) ? value.recommended_profile : null,
    recommended_protocol_version: [...REVISIONS, '2026-07-28'].includes(value.recommended_protocol_version)
      ? value.recommended_protocol_version : null,
    automatic_retry: false,
    next_step: 'Inspect this endpoint’s connection guide. Keep session initialize separate from stateless server/discover; do not replay an evaluation.'
  };
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('missing_response');
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('response_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const part of chunks) { joined.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(joined));
}

export function createFirstCheckClient({endpoint, headers = {}, fetchImpl = fetch, timeoutMs = 20000} = {}) {
  let url;
  try { url = new URL(endpoint); }
  catch { throw new FirstCheckError('invalid_endpoint', 'Supply the trusted HTTPS MCP endpoint.', {stage:'configuration'}); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !['/mcp', '/mcp/agent', '/mcp/output-verification'].includes(url.pathname)) {
    throw new FirstCheckError('invalid_endpoint', 'Use the trusted HTTPS MCP endpoint without credentials, query or fragment.', {stage:'configuration'});
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('Invalid timeout');
  endpoint = url.href;
  const fixed = new Headers(headers);
  for (const name of ['x-payment-tx', 'x-payment-signature', 'payment-signature', 'x-payment', 'mcp-method', 'mcp-name', 'mcp-session-id', 'mcp-protocol-version']) {
    if (fixed.has(name)) throw new FirstCheckError('incompatible_headers', 'Remove payment material and manual MCP profile headers from this free-check client.', {stage:'configuration'});
  }
  if (/^Bearer\s+agy_pro_/i.test(fixed.get('authorization') || '')) {
    throw new FirstCheckError('incompatible_headers', 'Use configured production authentication only; this client does not use Pro payment access.', {stage:'configuration'});
  }
  fixed.set('content-type', 'application/json');
  fixed.set('accept', 'application/json, text/event-stream');
  let revision = null, session = null, tools = null, pending = false, prepared = null;
  let attempted = false, completed = null;
  const fail = (code, message, stage, status = null, connection = null) => new FirstCheckError(code, message, {stage, status, connection});

  async function exclusive(action) {
    if (pending) throw fail('busy', 'Wait for the current request to finish.', 'client');
    pending = true;
    try { return await action(); } finally { pending = false; }
  }
  async function rpc(method, params, stage) {
    const notification = method === 'notifications/initialized';
    const id = notification ? undefined : crypto.randomUUID();
    const requestHeaders = new Headers(fixed);
    if (revision) requestHeaders.set('MCP-Protocol-Version', revision);
    if (session) requestHeaders.set('Mcp-Session-Id', session);
    let response;
    try {
      response = await fetchImpl(endpoint, {method:'POST', headers:requestHeaders, redirect:'error',
        signal:AbortSignal.timeout(timeoutMs), body:JSON.stringify({jsonrpc:'2.0', ...(notification ? {} : {id}), method, ...(params ? {params} : {})})});
    } catch { throw fail('transport_failed', stage === 'evaluate'
      ? 'The outcome is unknown. Do not retry automatically; retain this client and inspect the service before another evaluation.'
      : 'Connection failed or timed out. Check the endpoint and network; no automatic retry.', stage); }
    if (notification && [202,204].includes(response.status)) return null;
    let payload;
    try { payload = await boundedJson(response); }
    catch { throw fail('unreadable_response', 'The bounded JSON response could not be read. Inspect the serving endpoint before retrying.', stage, response.status); }
    const hint = connectionHint(payload?.error?.data?.connection_hint);
    if (!response.ok || payload?.error) {
      throw fail(response.status === 401 ? 'authentication_required' : 'connection_refused',
        response.status === 401 ? 'This endpoint requires its configured production credential.'
          : 'The MCP request was refused. Inspect the protocol diagnostic; no evaluation was replayed.', stage, response.status, hint);
    }
    if (!object(payload) || payload.jsonrpc !== '2.0' || payload.id !== id || !object(payload.result)) {
      throw fail('unexpected_response', 'The response does not match this MCP request.', stage, response.status);
    }
    if (payload.result.isError) {
      throw fail('tool_refused', 'The tool did not complete. Inspect input, current allowance and service availability; no paid fallback or automatic retry.', stage, response.status);
    }
    const returnedSession = response.headers.get('mcp-session-id');
    if (returnedSession) session = returnedSession;
    return payload.result;
  }
  async function connect() {
    if (tools) return;
    const init = await rpc('initialize', {protocolVersion:VERSION, capabilities:{}, clientInfo:{name:'agenda-first-check', version:'1'}}, 'initialize');
    if (!REVISIONS.includes(init.protocolVersion)) throw fail('unsupported_negotiation', 'This client requires the published MCP session profile. Inspect the connection guide.', 'initialize');
    revision = init.protocolVersion;
    await rpc('notifications/initialized', null, 'initialized');
    const catalog = await rpc('tools/list', {}, 'tools/list');
    if (!Array.isArray(catalog.tools) || catalog.tools.length > 500 || catalog.nextCursor) {
      throw fail('unsupported_catalog', 'A complete bounded tool catalog is required before preparing a check.', 'tools/list');
    }
    tools = catalog.tools;
  }
  const has = name => tools.some(tool => tool?.name === name);
  const freeReady = () => ['validate_input', 'free_trial_status', 'free_trial'].every(has);
  async function call(name, input, stage) {
    return (await rpc('tools/call', {name, arguments:input}, stage)).structuredContent;
  }
  function receipt(value, stage = 'feedback') {
    const trial = value?.trial;
    if (value?.contract_version !== 'agenda-first-check.v1' || value.endpoint !== endpoint ||
        !object(value.evaluation) || !object(trial) || !UUID.test(trial.attempt_id || '') ||
        trial.payment_required !== false || trial.completion_recorded !== true || trial.attempt_consumed !== true) {
      throw fail('completion_required', 'Use the unchanged saved result from a completed check on this exact endpoint.', stage);
    }
    return trial;
  }
  return Object.freeze({
    async inspect() { return exclusive(async () => {
      await connect();
      const example = tools.find(tool => tool?.name === 'free_trial')?._meta?.['com.agenda/readiness'];
      return {connected:true, protocol_version:revision, free_check_available:freeReady(), feedback_available:has('free_trial_feedback'),
        example_is_synthetic:example?.example_is_synthetic === true, example_input:clone(example?.example_arguments ?? null),
        evaluation_performed:false, attempt_consumed:false, payment_required:false};
    }); },
    async prepare(input) { return exclusive(async () => {
      if (attempted) throw fail('already_submitted', 'This client already submitted its one evaluation. Retain its result; create a new client only for an explicitly chosen new check.', 'prepare');
      prepared = null;
      if (!object(input)) throw fail('invalid_input', 'Input must be a JSON object containing the tool arguments, not an MCP envelope.', 'prepare');
      let saved;
      try {
        const serialized = JSON.stringify(input);
        if (new TextEncoder().encode(serialized).length > 131072) throw new Error('too_large');
        saved = JSON.parse(serialized);
        if (!object(saved)) throw new Error('object_required');
      } catch { throw fail('invalid_input', 'Input must serialize to a JSON object of at most 128 KiB.', 'prepare'); }
      await connect();
      if (!freeReady()) throw fail('free_check_unavailable', 'This endpoint does not advertise the complete free-check workflow. No evaluation or paid request was made.', 'prepare');
      const validation = await call('validate_input', {tool:'free_trial', input:saved}, 'validate');
      if (validation?.tool !== 'free_trial' || typeof validation.valid !== 'boolean' ||
          validation.evaluation_performed !== false || validation.attempt_consumed !== false ||
          validation.payment_required !== false || validation.authorization_granted !== false) {
        throw fail('unconfirmed_validation', 'Schema preflight could not be confirmed. No evaluation was submitted.', 'validate');
      }
      if (!validation.valid) return {prepared:false, valid:false, validation, evaluation_performed:false, attempt_consumed:false};
      const status = await call('free_trial_status', {}, 'availability');
      const availability = status?.availability;
      if (!['available','network_allowance_exhausted','daily_capacity_exhausted'].includes(availability?.status) ||
          availability.advisory !== true || availability.attempt_consumed !== false ||
          !Number.isInteger(availability.remaining_attempts) || availability.remaining_attempts < 0) {
        throw fail('unconfirmed_availability', 'Current free allowance could not be confirmed. No evaluation was submitted.', 'availability');
      }
      const ready = availability.status === 'available' && availability.remaining_attempts > 0;
      if (ready) prepared = saved;
      return {prepared:ready, valid:true, availability:clone(availability), evaluation_performed:false, attempt_consumed:false,
        next_step:ready ? 'Explicitly call evaluate() once; availability is advisory and another request can consume the allowance.'
          : 'Keep the input and any prior result. No automatic retry, quota reset or paid fallback.'};
    }); },
    async evaluate() { return exclusive(async () => {
      if (!prepared || attempted) throw fail('not_prepared', 'Prepare valid input with available allowance before explicitly evaluating once.', 'evaluate');
      attempted = true;
      const result = await call('free_trial', prepared, 'evaluate');
      const candidate = {...result, contract_version:'agenda-first-check.v1', endpoint};
      receipt(candidate, 'evaluate');
      completed = clone(candidate);
      return clone(completed);
    }); },
    async feedback(response, savedResult = completed) { return exclusive(async () => {
      if (!['useful_next_step','still_blocked'].includes(response)) throw fail('invalid_feedback', 'Choose useful_next_step or still_blocked after reviewing the result.', 'feedback');
      const trial = receipt(savedResult);
      await connect();
      if (!has('free_trial_feedback')) throw fail('feedback_unavailable', 'This endpoint does not advertise completion feedback.', 'feedback');
      const result = await call('free_trial_feedback', {attempt_id:trial.attempt_id, response}, 'feedback');
      if (result?.recorded !== true || result.response !== response || result.evaluation_performed !== false) {
        throw fail('feedback_unconfirmed', 'Feedback was not confirmed. The saved evaluation remains unchanged.', 'feedback');
      }
      return {recorded:true, response, evaluation_performed:false, self_report_only:true};
    }); }
  });
}

export async function runFirstCheckCli(argv, {readFile, writeFile, stdout, stderr, fetchImpl = fetch} = {}) {
  const args = [...argv];
  const owner = args.includes('--owner-test');
  if (owner) args.splice(args.indexOf('--owner-test'), 1);
  const outIndex = args.indexOf('--out');
  const out = outIndex < 0 ? null : args.splice(outIndex, 2)[1];
  const [mode, endpoint, file, choice] = args;
  try {
    if (!['inspect','example','validate','evaluate','feedback'].includes(mode) || !endpoint ||
        args.length !== (['inspect','example'].includes(mode) ? 2 : mode === 'feedback' ? 4 : 3) || (outIndex >= 0 && !out)) {
      throw new FirstCheckError('usage', 'Usage: node first-check.mjs inspect/example MCP_URL [--out JSON_FILE] | validate/evaluate MCP_URL INPUT_JSON [--out RESULT_JSON] | feedback MCP_URL RESULT_JSON useful_next_step|still_blocked. Optional maintainer flag: --owner-test.', {stage:'configuration'});
    }
    const client = createFirstCheckClient({endpoint, fetchImpl,
      headers:owner ? {'X-Client-Id':'agenda-owner-first-check'} : {}});
    let result;
    if (['inspect','example'].includes(mode)) {
      result = await client.inspect();
      if (mode === 'example') {
        if (result.example_is_synthetic !== true || !object(result.example_input)) {
          throw new FirstCheckError('example_unavailable', 'This endpoint has no declared synthetic free-check example.', {stage:'example'});
        }
        stderr('Synthetic example only: replace illustrative values with authorized evidence before a real review. No evaluation was submitted.\n');
        result = result.example_input;
      }
    }
    else {
      let input;
      try {
        const raw = await readFile(file, 'utf8');
        if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('too_large');
        input = JSON.parse(raw);
      } catch { throw new FirstCheckError('invalid_json_file', 'Read a bounded UTF-8 JSON file; malformed or missing input was not submitted.', {stage:'input'}); }
      if (mode === 'feedback') result = await client.feedback(choice, input);
      else {
        result = await client.prepare(input);
        if (mode === 'evaluate' && result.prepared) result = await client.evaluate();
      }
    }
    const rendered = JSON.stringify(result, null, 2) + '\n';
    stdout(rendered);
    if (out) {
      try { await writeFile(out, rendered, {flag:'wx', mode:0o600}); }
      catch { throw new FirstCheckError('result_save_failed', 'The result is printed above, but the new private file could not be saved. Keep stdout; never retry an evaluation to save it again.', {stage:'save'}); }
    }
    return ['validate','evaluate'].includes(mode) && result.prepared === false ? 2 : 0;
  } catch (error) {
    stderr(JSON.stringify(error instanceof FirstCheckError
      ? {code:error.code, stage:error.stage, message:error.message, http_status:error.status, connection:error.connection}
      : {code:'client_failed', message:'The client could not finish. Keep any saved result; no automatic evaluation retry or payment.'}) + '\n');
    return 1;
  }
}

// Dynamic Node built-ins keep the importable client independent of a CLI process.
if (typeof process !== 'undefined' && process.argv[1]) {
  const {pathToFileURL} = await import('node:url');
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const {readFile, writeFile} = await import('node:fs/promises');
    process.exitCode = await runFirstCheckCli(process.argv.slice(2), {readFile, writeFile,
      stdout:value => process.stdout.write(value), stderr:value => process.stderr.write(value)});
  }
}
