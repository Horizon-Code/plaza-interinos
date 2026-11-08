/// <reference path="../types.d.ts" />

const API = 'https://plazainterinos-api.fly.dev';

/**
 * Identificador público de la app en Google: el mismo que `GOOGLE_CLIENT_ID`
 * en `infra/fly.toml`. No es un secreto (viaja en cada petición de acceso).
 * Se puede sobrescribir con la variable `GOOGLE_CLIENT_ID` de Cloudflare Pages.
 */
const GOOGLE_CLIENT_ID =
  '962674203904-8238mb9hni25hd1agublufuos6a7nl4k.apps.googleusercontent.com';

type Env = { GOOGLE_CLIENT_ID?: string };

export const onRequest: CloudflarePagesFunction<Env> = async ({ request, params, env, waitUntil }) => {
  const incomingUrl = new URL(request.url);
  const pathParam = params.path;
  const path = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');

  /**
   * La pantalla de entrada necesita esto para pintar el botón de Google. Si se
   * pidiera a Fly, con la máquina dormida el recuadro se quedaba vacío varios
   * segundos y la gente se iba. Se responde aquí al instante y, en paralelo,
   * se despierta la API: para cuando la persona ha elegido su cuenta de
   * Google, la API ya está en pie para recibir el login.
   */
  if (path === 'auth/google/config' && request.method === 'GET') {
    waitUntil(fetch(`${API}/api/health`).catch(() => undefined));
    return Response.json(
      { clientId: env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID },
      { headers: { 'cache-control': 'no-store' } }
    );
  }

  const targetUrl = new URL(`${API}/api/${path}`);
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
