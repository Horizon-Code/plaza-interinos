export interface Comunidad {
  /** Sufijo de la clase CSS de la bandera: `.bandera-aragon`. */
  id: string;
  nombre: string;
  /** Solo Aragón tiene catálogo de centros y parser de convocatoria. */
  disponible: boolean;
}

/**
 * Comunidades autónomas, con Aragón primero por ser la única jugable. El resto
 * se listan deshabilitadas: enseñan a dónde va esto sin prometer que funcione.
 *
 * Las banderas son siluetas de color en CSS (ver `.bandera-*` en styles.css),
 * no reproducciones: a 20 px un escudo es una mancha, así que no se dibuja.
 * Eso hace que Aragón y Cataluña se vean igual —ambas son la señal de cuatro
 * palos— y que las de carga heráldica queden reducidas a su campo.
 */
export const COMUNIDADES: Comunidad[] = [
  { id: 'aragon', nombre: 'Aragón', disponible: true },
  { id: 'andalucia', nombre: 'Andalucía', disponible: false },
  { id: 'asturias', nombre: 'Asturias', disponible: false },
  { id: 'baleares', nombre: 'Illes Balears', disponible: false },
  { id: 'canarias', nombre: 'Canarias', disponible: false },
  { id: 'cantabria', nombre: 'Cantabria', disponible: false },
  { id: 'castilla-la-mancha', nombre: 'Castilla-La Mancha', disponible: false },
  { id: 'castilla-y-leon', nombre: 'Castilla y León', disponible: false },
  { id: 'cataluna', nombre: 'Catalunya', disponible: false },
  { id: 'extremadura', nombre: 'Extremadura', disponible: false },
  { id: 'galicia', nombre: 'Galicia', disponible: false },
  { id: 'la-rioja', nombre: 'La Rioja', disponible: false },
  { id: 'madrid', nombre: 'Madrid', disponible: false },
  { id: 'murcia', nombre: 'Murcia', disponible: false },
  { id: 'navarra', nombre: 'Navarra', disponible: false },
  { id: 'pais-vasco', nombre: 'Euskadi', disponible: false },
  { id: 'valencia', nombre: 'Comunitat Valenciana', disponible: false }
];
