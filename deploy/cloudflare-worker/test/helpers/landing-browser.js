// VM browser harness: load external same-origin scripts as a browser does.
// Non-HTML integration responses are returned unchanged. Compact-document
// assertions use handleRequest directly, without this harness.
export function withLandingScripts(handleRequest) {
  return async (request, env, ctx) => {
    const response = await handleRequest(request, env, ctx);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;
    const html = await response.text();
    if (!html.includes('<script src="/landing-client.js" defer></script>')) {
      return new Response(html, response);
    }
    const script = await handleRequest(new Request(new URL('/landing-client.js', request.url)), env, ctx);
    if (script.status !== 200) throw new Error('Landing client failed to load: ' + script.status);
    const source = await script.text();
    return new Response(html.replace('<script src="/landing-client.js" defer></script>',
      () => '<script>' + source + '</script>'), response);
  };
}
