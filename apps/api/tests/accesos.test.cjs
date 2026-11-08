const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AccesosService } = require(process.cwd() + '/dist/src/auth/accesos.service');
function prismaFalso() {
  const creados = [];
  return { creados, acceso: {
    create: async ({ data }) => { creados.push(data); },
    deleteMany: async () => ({ count: 0 }),
    findMany: async () => [{ createdAt: new Date(), tipo: 'google', ip: '1.2.3.4', userAgent: 'x', user: { email: 'a@b.es', name: 'A' } }]
  }};
}
test('visitas se apuntan una vez cada 30 min; entradas siempre; IP de Fly', async () => {
  const p = prismaFalso(); const s = new AccesosService(p);
  const req = { ip: '10.0.0.1', headers: { 'fly-client-ip': '88.1.2.3', 'user-agent': 'Firefox' } };
  s.registrarVisita('u1', req); s.registrarVisita('u1', req); s.registrarVisita('u2', req);
  s.registrarEntrada('u1', req);
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(p.creados.map(c => [c.userId, c.tipo]), [['u1','sesion'],['u2','sesion'],['u1','google']]);
  assert.equal(p.creados[0].ip, '88.1.2.3');
  assert.equal(p.creados[0].userAgent, 'Firefox');
});
test('un fallo de base no rompe la petición', async () => {
  const s = new AccesosService({ acceso: { create: async () => { throw new Error('caída'); } } });
  s.registrarEntrada('u1'); await new Promise(r => setTimeout(r, 10));
});
test('historial solo para ADMIN_EMAILS', async () => {
  process.env.ADMIN_EMAILS = 'Jefa@x.es, otro@x.es';
  const s = new AccesosService(prismaFalso());
  await assert.rejects(() => s.listar('intruso@x.es', 7), /administración/);
  await assert.rejects(() => s.listar(undefined, 7));
  const r = await s.listar('jefa@x.es', 7);
  assert.equal(r.personasDistintas, 1); assert.equal(r.accesos[0].email, 'a@b.es');
});
