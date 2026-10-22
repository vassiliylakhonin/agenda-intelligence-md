// Own-origin delivery: never fetch the Pages hostname in the request path.
export const SNAPSHOT_HOST = 'sanctions-index.agendamcp.dpdns.org';
export const SNAPSHOT_PATH = '/sanctions-name-index-compact.json';

export async function snapshotAssetResponse(request, env) {
  const url = new URL(request.url);
  if (url.hostname !== SNAPSHOT_HOST) return null;
  if (url.pathname !== SNAPSHOT_PATH) return new Response('Not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  if (env.AGENT_PROFILE !== 'cis_secondary_sanctions' || !env.SNAPSHOT_ASSETS?.fetch) {
    return new Response('Snapshot unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
  try {
    const assetRequest = new Request('https://snapshot-assets.local' + SNAPSHOT_PATH, {
      method: request.method,
      headers: request.headers
    });
    const asset = await env.SNAPSHOT_ASSETS.fetch(assetRequest);
    if (![200, 304].includes(asset.status)) {
      return new Response('Snapshot unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    const headers = new Headers(asset.headers);
    headers.set('x-agenda-snapshot-origin', 'worker-static-assets');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('access-control-allow-origin', '*');
    headers.set('cache-control', 'public, max-age=300, must-revalidate');
    return new Response(asset.body, { status: asset.status, headers });
  } catch {
    return new Response('Snapshot unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
