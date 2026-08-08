/// <reference path="../types.d.ts" />

export const onRequest: CloudflarePagesFunction = async ({ request, params }) => {
  const incomingUrl = new URL(request.url);
  const pathParam = params.path;
  const path = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');
  const targetUrl = new URL(`https://plazainterinos-api.fly.dev/api/${path}`);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));

  return fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual'
  });
};
