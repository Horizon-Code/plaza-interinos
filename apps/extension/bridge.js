// Puente entre la web de TuPlaza y la extensión.
// Responde al handshake y reenvía la orden de rellenar al content script de PADDOC.
// La sesión de PADDOC NUNCA pasa por aquí: solo mandamos la lista de IDs.

let paddocActivo = false;

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.source !== 'tuplaza-app') return;

  if (data.type === 'ping') {
    window.postMessage({ source: 'tuplaza-ext', type: 'pong', paddoc: paddocActivo }, '*');
  }

  if (data.type === 'rellenar' && Array.isArray(data.vacancyIds)) {
    chrome.runtime.sendMessage({ type: 'rellenar', vacancyIds: data.vacancyIds });
  }
});

// Pregunta periódicamente al background si hay sesión de PADDOC abierta.
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'estado-paddoc' }, (resp) => {
    paddocActivo = !!(resp && resp.activo);
  });
}, 2000);
