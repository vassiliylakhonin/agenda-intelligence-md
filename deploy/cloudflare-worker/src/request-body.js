// Bound bytes while reading, including requests without Content-Length.
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

const INPUT_DIAGNOSTICS = {
  failure: ['empty_body', 'invalid_utf8', 'malformed_json', 'body_too_large', 'read_failed'],
  media_type: ['json', 'form_urlencoded', 'multipart', 'text', 'other', 'missing'],
  origin_relation: ['same_origin', 'cross_origin', 'absent', 'invalid'],
  referrer_relation: ['same_origin', 'agenstry', 'other', 'absent', 'invalid']
};

// Finite labels only. Neither parser messages nor header values cross this seam.
export function safeJsonInputDiagnostics(value) {
  if (!value || typeof value !== 'object') return null;
  const safe = {};
  for (const [key, choices] of Object.entries(INPUT_DIAGNOSTICS)) {
    if (!choices.includes(value[key])) return null;
    safe[key] = value[key];
  }
  return safe;
}

export function jsonInputDiagnostics(request, error) {
  const media = (request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  const relation = header => {
    const raw = request.headers.get(header);
    if (!raw) return 'absent';
    try {
      const url = new URL(raw);
      if (!['https:', 'http:'].includes(url.protocol) || (header === 'origin' && url.origin !== raw)) return 'invalid';
      if (url.origin === new URL(request.url).origin) return 'same_origin';
      return header === 'origin' ? 'cross_origin' : url.hostname === 'agenstry.com' ? 'agenstry' : 'other';
    } catch { return 'invalid'; }
  };
  return safeJsonInputDiagnostics({
    failure: INPUT_DIAGNOSTICS.failure.includes(error?.json_body_failure) ? error.json_body_failure : 'read_failed',
    media_type: !media ? 'missing' : media === 'application/json' || /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(media) ? 'json'
      : media === 'application/x-www-form-urlencoded' ? 'form_urlencoded' : media === 'multipart/form-data' ? 'multipart'
      : media.startsWith('text/') ? 'text' : 'other',
    origin_relation: relation('origin'), referrer_relation: relation('referer')
  });
}

function bodyError(failure, status = 400) {
  return Object.assign(new Error(failure === 'body_too_large' ? 'JSON body exceeds byte limit' : 'Invalid JSON payload'),
    { status, json_body_failure: failure });
}

export async function readBoundedJson(request, maxBytes = MAX_JSON_BODY_BYTES) {
  const tooLarge = () => bodyError('body_too_large', 413);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  if (!request.body) throw bodyError('empty_body');
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error?.json_body_failure === 'body_too_large') throw error;
    throw bodyError('read_failed');
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!bytes) throw bodyError('empty_body');
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(body); }
  catch { throw bodyError('invalid_utf8'); }
  try { return JSON.parse(text); }
  catch { throw bodyError('malformed_json'); }
}
