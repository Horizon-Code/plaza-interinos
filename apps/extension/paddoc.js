// Content script que corre DENTRO de paddoc.aragon.es, en la sesión del usuario.
// Aquí es donde, en fase 2, se reproduce la secuencia de peticiones que Rubén
// ya mapeó con curls: en serie, validando cada respuesta y PARANDO ante error.
//
// PATRÓN OBLIGATORIO (acordado):
//   - fetch en serie con await, nunca en paralelo;
//   - validar la respuesta de cada plaza antes de seguir;
//   - detener toda la secuencia si algo no encaja (nunca envíos a medias);
//   - el POST de confirmación EN FIRME lo dispara el usuario, no este script.
//
// Los endpoints van como adaptador versionado: paddoc_v1. Cuando la DGA cambie
// el formato, se crea paddoc_v2 sin tocar el anterior.

const PADDOC_V1 = {
  // TODO(Rubén): rellenar con los endpoints reales mapeados desde devtools.
  guardarPlaza: (idPlaza, orden) => ({
    url: '/epdtp/REEMPLAZAR-ENDPOINT-REAL',
    method: 'POST',
    body: { idPlaza, orden }
  }),
  esRespuestaValida: (resp) => resp.ok
};

async function rellenar(vacancyIds) {
  for (let i = 0; i < vacancyIds.length; i++) {
    const paso = PADDOC_V1.guardarPlaza(vacancyIds[i], i + 1);
    let resp;
    try {
      resp = await fetch(paso.url, {
        method: paso.method,
        headers: { 'content-type': 'application/json' },
        credentials: 'include',              // la cookie de sesión la adjunta el navegador
        body: JSON.stringify(paso.body)
      });
    } catch (e) {
      return reportar(i, vacancyIds.length, 'error_red');
    }
    if (!PADDOC_V1.esRespuestaValida(resp)) {
      return reportar(i, vacancyIds.length, 'respuesta_invalida');  // PARADA
    }
    reportar(i + 1, vacancyIds.length, 'ok');
    await new Promise(r => setTimeout(r, 250));  // ritmo humano, no ráfaga
  }
}

function reportar(hechas, total, estado) {
  chrome.runtime.sendMessage({ type: 'progreso', hechas, total, estado });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'rellenar') rellenar(msg.vacancyIds);
});
