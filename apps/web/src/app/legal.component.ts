import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Privacidad y aviso legal.
 *
 * Los textos están redactados a partir de lo que la aplicación hace de verdad
 * —qué se guarda, dónde, a quién se le manda y cuánto dura—, no copiados de
 * una plantilla. Aun así son un borrador: hay huecos entre corchetes con los
 * datos del responsable que solo puede rellenar su titular, y conviene que los
 * revise alguien que sepa de esto antes de abrir al público.
 *
 * Son rutas públicas a propósito: quien todavía no ha entrado tiene derecho a
 * leer qué vamos a hacer con sus datos ANTES de dar su correo.
 */
@Component({
  selector: 'tp-legal',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="legal">
      <p><a routerLink="/entrar">← Volver</a></p>

      <h1>Privacidad</h1>
      <p class="lead">
        Qué guardamos, por qué, y cómo deshacerlo. En corto: tu correo y la dirección
        desde la que calculas los trayectos. Nada más, y puedes borrarlo todo cuando quieras.
      </p>

      <h2>Quién es el responsable</h2>
      <p>
        [NOMBRE O RAZÓN SOCIAL], [NIF], [DIRECCIÓN POSTAL].
        Contacto: <strong>[CORREO DE CONTACTO]</strong>.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <strong>Tu correo electrónico</strong> y el identificador de tu cuenta de Google.
          Es lo único que identifica tu cuenta: no hay contraseñas, y nosotros nunca
          llegamos a ver la tuya.
        </li>
        <li>
          <strong>La dirección desde la que calculas los trayectos</strong>, y sus coordenadas.
          Sin ella no se puede saber a qué distancia te queda cada centro.
        </li>
        <li>
          <strong>Tus preferencias y tus listas</strong>: especialidades, límites de distancia,
          las vacantes del PDF que subes y el resultado de ordenarlas.
        </li>
        <li>
          <strong>Fechas de creación y de último acceso</strong> de la cuenta.
        </li>
      </ul>
      <p>
        No usamos cookies de seguimiento, ni analítica, ni publicidad. No hay perfilado
        ni decisiones automatizadas sobre ti: la aplicación ordena vacantes, no personas.
      </p>

      <h2>Para qué los usamos</h2>
      <p>
        Solo para prestarte el servicio: dejarte entrar, calcular distancias desde tu casa
        y ordenar tus vacantes. La base legal es la ejecución del servicio que nos pides
        al crear la cuenta.
      </p>

      <h2>Con quién se comparten</h2>
      <p>
        No vendemos ni cedemos datos a nadie. Para funcionar, la aplicación se apoya en:
      </p>
      <ul>
        <li>
          <strong>Google</strong>, únicamente para identificarte al entrar. Google nos
          confirma tu correo; no le damos nada tuyo ni accedemos a nada de tu cuenta.
        </li>
        <li><strong>Neon</strong>, donde vive la base de datos.</li>
        <li><strong>Fly.io</strong> y <strong>Cloudflare</strong>, que ejecutan y sirven la aplicación.</li>
        <li>
          <strong>OpenStreetMap</strong> (Nominatim y OSRM), para convertir tu dirección en
          coordenadas y calcular las rutas. Se les envía la dirección o las coordenadas,
          nunca tu correo ni nada que te identifique.
        </li>
      </ul>

      <h2>Cuánto tiempo</h2>
      <p>
        Mientras tengas la cuenta. Cuando la borras, se borra todo de inmediato y sin
        copia: tu cuenta, tus perfiles, tus convocatorias y sus listas. Borrar la cuenta
        aquí no afecta a tu cuenta de Google, que es tuya y sigue igual.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, rectificarlos, borrarlos, oponerte al tratamiento,
        limitarlo y pedir que te los demos en un fichero. Los dos más inmediatos los
        tienes dentro de la aplicación, en <strong>Perfil → Tu cuenta</strong>: descargar
        todo lo que guardamos de ti, y borrar la cuenta entera.
      </p>
      <p>
        Para lo demás, escribe a [CORREO DE CONTACTO]. Si crees que no hemos hecho las
        cosas bien, puedes reclamar ante la
        <a href="https://www.aepd.es" target="_blank" rel="noopener">Agencia Española de Protección de Datos</a>.
      </p>

      <hr />

      <h1 id="aviso-legal">Aviso legal</h1>

      <h2>Titular</h2>
      <p>
        [NOMBRE O RAZÓN SOCIAL], [NIF], [DIRECCIÓN POSTAL]. Contacto: [CORREO DE CONTACTO].
      </p>

      <h2>Qué es esto y qué no es</h2>
      <p>
        PlazaInterinos es una herramienta que te ayuda a ordenar y filtrar las vacantes
        de un proceso de adjudicación a partir del PDF oficial que tú subes.
      </p>
      <p class="aviso-fuerte">
        No es una fuente oficial ni sustituye al boletín, a la convocatoria ni a la
        Administración. La única lista válida es la que presentas en el procedimiento
        oficial: revisa siempre el resultado antes de darlo por bueno.
      </p>
      <p>
        Ponemos cuidado en que los cálculos sean correctos, pero la información procede
        de documentos que interpretamos automáticamente y de servicios de terceros que
        pueden fallar o estar desactualizados. Los tiempos de trayecto son estimaciones
        sin tráfico real. No respondemos de las decisiones que tomes a partir de ellos.
      </p>

      <h2>Uso</h2>
      <p>
        El servicio es gratuito. Te comprometes a usarlo de buena fe y a no intentar
        acceder a datos de otras personas ni a perturbar su funcionamiento.
      </p>

      <h2>Propiedad</h2>
      <p>
        El código y el diseño son de su titular. Los datos de las convocatorias pertenecen
        a la Administración que los publica. La cartografía y las rutas proceden de
        OpenStreetMap y sus colaboradores, bajo licencia ODbL.
      </p>
    </main>
  `,
  styles: [`
    .legal { max-width: 720px; margin: 0 auto; padding: 24px 20px 80px; }
    .legal h1 { font-size: 28px; margin: 24px 0 8px; }
    .legal h2 { font-size: 18px; margin: 26px 0 6px; }
    .legal p, .legal li { font-size: 15px; }
    .legal ul { padding-left: 20px; }
    .legal li { margin-bottom: 6px; }
    .legal hr { border: none; border-top: 1px solid var(--linea); margin: 40px 0; }
  `]
})
export class LegalComponent {}
