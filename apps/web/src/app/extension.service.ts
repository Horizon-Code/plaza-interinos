import { Injectable, signal } from '@angular/core';

/**
 * Detección de la extensión de PlazaInterinos como MEJORA OPCIONAL.
 *
 * El núcleo de la app (subir PDF, perfil, ordenar, exportar) NO depende de
 * esto. La extensión solo habilita la acción final "Rellenar en PADDOC".
 * Mientras no esté, todo funciona y el usuario exporta a CSV.
 *
 * Protocolo (handshake continuo, no comprobación única):
 *   app  -> window.postMessage({ source: 'tuplaza-app', type: 'ping' })
 *   ext  -> window.postMessage({ source: 'tuplaza-ext', type: 'pong', paddoc: boolean })
 *
 * La extensión (content script, fase 2) responde el pong e informa además de
 * si detecta sesión activa en PADDOC. Si dejan de llegar pongs, la app vuelve
 * a estado 'no detectada' sola: el estado manda sobre la interfaz.
 */
export type EstadoExtension = 'sin_extension' | 'extension_lista' | 'paddoc_activo';

@Injectable({ providedIn: 'root' })
export class ExtensionService {
  readonly estado = signal<EstadoExtension>('sin_extension');
  private ultimoPong = 0;

  iniciar(): void {
    window.addEventListener('message', event => {
      const data = event.data;
      if (!data || data.source !== 'tuplaza-ext') return;
      if (data.type === 'pong') {
        this.ultimoPong = Date.now();
        this.estado.set(data.paddoc ? 'paddoc_activo' : 'extension_lista');
      }
    });

    setInterval(() => {
      window.postMessage({ source: 'tuplaza-app', type: 'ping' }, '*');
      if (this.ultimoPong && Date.now() - this.ultimoPong > 4000) {
        this.estado.set('sin_extension');
      }
    }, 1500);
  }

  get conectada(): boolean {
    return this.estado() !== 'sin_extension';
  }
  get paddocListo(): boolean {
    return this.estado() === 'paddoc_activo';
  }
}
