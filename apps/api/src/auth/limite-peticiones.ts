/**
 * Límite de peticiones en memoria para el envío de enlaces de acceso.
 *
 * Sin esto, `/auth/magic-link` es un enviador de correo gratuito y anónimo:
 * cualquiera puede pedir mil enlaces al correo de otra persona.
 *
 * En memoria y no en base de datos porque la API corre en una sola instancia
 * (Fly.io) y esto no necesita sobrevivir a un reinicio: reiniciar solo perdona
 * un puñado de intentos. Si algún día hay varias instancias, esto pasa a Redis.
 */
export class LimitePeticiones {
  private readonly intentos = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly ventanaMs: number
  ) {}

  /** true si la petición cabe dentro del límite (y la contabiliza). */
  permite(clave: string): boolean {
    const ahora = Date.now();
    const recientes = (this.intentos.get(clave) ?? []).filter(t => ahora - t < this.ventanaMs);
    if (recientes.length >= this.maximo) {
      this.intentos.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    this.intentos.set(clave, recientes);
    this.limpiar(ahora);
    return true;
  }

  /** Las claves que ya no tienen intentos vivos se van: el Map no crece sin fin. */
  private limpiar(ahora: number): void {
    if (this.intentos.size < 500) return;
    for (const [clave, marcas] of this.intentos) {
      if (marcas.every(t => ahora - t >= this.ventanaMs)) this.intentos.delete(clave);
    }
  }
}
