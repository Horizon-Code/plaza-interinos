const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { RutasService, clavePunto } = require('../dist/src/geo/rutas.service');
const { EvaluacionService } = require('../dist/src/evaluacion/evaluacion.service');
const { PerfilService } = require('../dist/src/perfil/perfil.service');
const { PerfilDto } = require('../dist/src/perfil/dto/perfil.dto');
const { ValidationPipe } = require('@nestjs/common');
const { DEFAULT_WEIGHTS } = require('@plazainterinos/core');

const fetchOriginal = global.fetch;
afterEach(() => { global.fetch = fetchOriginal; });
// Puntos públicos del catálogo; respuestas de rutas sintéticas, sin geocodificar domicilios.
const origen = { lat: 41.6488, lng: -0.8891 };
const alcaniz = { lat: 41.053293, lng: -0.129947 };
const teruel = { lat: 40.3456, lng: -1.1065 };
const ok = data => ({ ok: true, json: async () => ({ code: 'Ok', ...data }) });

function proveedorSintetico() {
  const peticiones = [];
  global.fetch = async url => {
    const u = new URL(url);
    peticiones.push(u);
    const puntos = u.pathname.split('/').at(-1).split(';');
    const indices = u.searchParams.has('destinations')
      ? u.searchParams.get('destinations').split(';').map(Number)
      : puntos.map((_, i) => i);
    // Emula OSRM: si no se piden destinos, incluye origen → origen = 0.
    return ok({ distances: [indices.map(i => i * 100_000)], durations: [indices.map(i => i * 3600)] });
  };
  return peticiones;
}

test('primer y último centro reciben su columna; centros repetidos comparten ruta', async () => {
  const llamadas = proveedorSintetico();
  const service = new RutasService();
  const rutas = await service.calcular(origen, [alcaniz, alcaniz, teruel]);
  assert.deepEqual(rutas.get(clavePunto(alcaniz)), { km: 100, minutos: 60 });
  assert.deepEqual(rutas.get(clavePunto(teruel)), { km: 200, minutos: 120 });
  assert.equal(rutas.size, 2);
  assert.equal(llamadas[0].searchParams.get('destinations'), '1;2');
  assert.match(llamadas[0].pathname, /-0.8891,41.6488;/);
  await service.calcular(origen, [teruel, alcaniz]);
  assert.equal(llamadas.length, 1);
  await service.calcular({ ...origen, lat: 41.7 }, [alcaniz]);
  assert.equal(llamadas.length, 2, 'cambiar origen recalcula');
});

test('reinicia índices al superar una tanda', async () => {
  const llamadas = proveedorSintetico();
  const destinos = Array.from({ length: 97 }, (_, i) => ({ lat: 41 + i / 1000, lng: -1 }));
  const rutas = await new RutasService().calcular(origen, destinos);
  assert.equal(rutas.size, 97);
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[1].searchParams.get('destinations'), '1;2');
  assert.deepEqual(rutas.get(clavePunto(destinos[96])), { km: 200, minutos: 120 });
});

test('ruta ausente o inválida no se convierte en cero; conserva un cero válido', async () => {
  global.fetch = async () => ok({ distances: [[null, -1, 0]], durations: [[null, 60, 0]] });
  const rutas = await new RutasService().calcular(origen, [alcaniz, teruel, origen]);
  assert.equal(rutas.has(clavePunto(alcaniz)), false);
  assert.equal(rutas.has(clavePunto(teruel)), false);
  assert.deepEqual(rutas.get(clavePunto(origen)), { km: 0, minutos: 0 });
});

test('convierte metros/segundos, sin redondear rutas cortas positivas a cero', async () => {
  global.fetch = async () => ok({ distances: [[123456, 12]], durations: [[4567, 12]] });
  const rutas = await new RutasService().calcular(origen, [alcaniz, teruel]);
  assert.deepEqual(rutas.get(clavePunto(alcaniz)), { km: 123.5, minutos: 76 });
  assert.deepEqual(rutas.get(clavePunto(teruel)), { km: 0.1, minutos: 1 });
});

test('respuestas desalineadas y fallos de red son recuperables', async () => {
  const service = new RutasService();
  global.fetch = async () => ok({ distances: [[0, 1000]], durations: [[0, 60]] });
  assert.equal((await service.calcular(origen, [alcaniz])).size, 0);
  global.fetch = async () => { throw new Error('sin conexión'); };
  assert.equal((await service.calcular(origen, [alcaniz])).size, 0);
  proveedorSintetico();
  assert.equal((await service.calcular(origen, [alcaniz])).size, 1);
});

test('coordenadas inválidas no llegan al proveedor', async () => {
  const llamadas = proveedorSintetico();
  const service = new RutasService();
  assert.equal((await service.calcular({ lat: 91, lng: 0 }, [alcaniz])).size, 0);
  assert.equal((await service.calcular(origen, [{ lat: NaN, lng: 0 }, { lat: 41, lng: 181 }])).size, 0);
  assert.equal(llamadas.length, 0);
});

function basePerfil() {
  return {
    id: 'perfil', name: 'Prueba', homeLat: origen.lat, homeLng: origen.lng,
    specialties: [{ bodyCode: '0590', specialtyCode: '006' }],
    acceptsPartialWorkload: true, acceptsVoluntary: true, acceptsAfternoon: true,
    acceptsItinerant: true, acceptsBilingual: true, acceptsLongTerm: true,
    acceptedLanguages: [], excludedPrograms: [], excludedTags: [],
    preferredMunicipalities: [], excludedMunicipalities: [], preferredCenters: [], excludedCenters: [],
    rankingWeights: DEFAULT_WEIGHTS, travelMode: 'minutes', maxTravelMinutes: 45,
    carFuelType: 'gasolina', carConsumption: 6, fuelPriceOverride: 1.5
  };
}

test('filtros y evaluación coinciden para varias vacantes del IES Bajo Aragón, y calculan coste y exclusión', async () => {
  const llamadas = proveedorSintetico();
  const rows = ['v1', 'v2'].map(id => ({
    id, centerCode: '44005177', centerName: 'IES Bajo Aragón', municipality: 'Alcañiz',
    bodyCode: '0590', specialtyCode: '006', workload: 1, voluntary: true,
    requirements: [], tags: [] // Sin coordenadas: convocatoria antigua recuperada por catálogo.
  }));
  let guardadas;
  const service = new EvaluacionService({
    convocatoria: { findFirst: async () => ({ id: 'convocatoria' }) },
    profile: { findFirst: async () => basePerfil() },
    vacancy: { findMany: async () => rows },
    evaluation: { deleteMany: async () => {}, createMany: async ({ data }) => { guardadas = data; } }
  }, {}, new RutasService());
  const preview = await service.trayectos('usuario', 'convocatoria', origen);
  const resultado = await service.evaluar('usuario', 'convocatoria');
  assert.equal(resultado.excluded.length, 2);
  for (const e of resultado.excluded) {
    assert.deepEqual(preview[e.vacancyId], { distanceKm: e.distanceKm, travelMinutes: e.travelMinutes });
    assert.equal(e.distanceKm, 100);
    assert.equal(e.travelMinutes, 60);
    assert.equal(e.dailyCostEur, 18);
    assert(e.hardExclusionReasons.some(r => r.reasonCode === 'travel-time-exceeded'));
  }
  assert.equal(llamadas.length, 1);
  assert.equal(guardadas[0].distanceKm, 100);
});

test('guardar perfil elimina coordenadas y límites antiguos cuando se vacían', async () => {
  let guardado;
  const service = new PerfilService({ profile: {
    findFirst: async () => ({ id: 'p' }),
    update: async ({ data }) => { guardado = data; return data; }
  } });
  await service.upsert('usuario', { homeLocation: { address: 'Nueva dirección sin comprobar' }, specialties: [], travelMode: 'km' });
  assert.equal(guardado.homeLat, null);
  assert.equal(guardado.homeLng, null);
  assert.equal(guardado.maxTravelMinutes, null);
  assert.equal(guardado.maxDistanceKm, null);
  await service.upsert('usuario', { homeLocation: { latitude: origen.lat, longitude: origen.lng }, specialties: [], maxDistanceKm: 0 });
  assert.equal(guardado.homeLat, origen.lat);
  assert.equal(guardado.maxDistanceKm, 0);
});

test('la API rechaza ubicaciones fuera de rango y límites negativos', async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  await assert.rejects(() => pipe.transform({ homeLocation: { latitude: 100, longitude: -200 }, maxDistanceKm: -1 }, { type: 'body', metatype: PerfilDto }));
});
