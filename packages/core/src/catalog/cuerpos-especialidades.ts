/**
 * Catálogo de cuerpos y especialidades docentes de Aragón.
 * GENERADO por `npm run build:catalog` a partir de docs/vacantes.pdf — no editar a mano.
 */

export interface CatalogoEspecialidad {
  code: string;
  name: string;
}

export interface CatalogoCuerpo {
  code: string;
  name: string;
  especialidades: CatalogoEspecialidad[];
}

export const CUERPOS: CatalogoCuerpo[] = [
  {
    "code": "0590",
    "name": "PROFESORES DE ENSEÑANZA SECUNDARIA",
    "especialidades": [
      {
        "code": "001",
        "name": "FILOSOFIA"
      },
      {
        "code": "002",
        "name": "GRIEGO"
      },
      {
        "code": "003",
        "name": "LATIN"
      },
      {
        "code": "004",
        "name": "LENGUA CASTELLANA Y LITERATURA"
      },
      {
        "code": "005",
        "name": "GEOGRAFIA E HISTORIA"
      },
      {
        "code": "006",
        "name": "MATEMATICAS"
      },
      {
        "code": "007",
        "name": "FISICA Y QUIMICA"
      },
      {
        "code": "008",
        "name": "BIOLOGIA Y GEOLOGIA"
      },
      {
        "code": "009",
        "name": "DIBUJO"
      },
      {
        "code": "010",
        "name": "FRANCES"
      },
      {
        "code": "011",
        "name": "INGLES"
      },
      {
        "code": "012",
        "name": "ALEMAN"
      },
      {
        "code": "016",
        "name": "MUSICA"
      },
      {
        "code": "017",
        "name": "EDUCACION FISICA"
      },
      {
        "code": "018",
        "name": "ORIENTACIÓN EDUCATIVA"
      },
      {
        "code": "019",
        "name": "TECNOLOGIA"
      },
      {
        "code": "051",
        "name": "LENGUA CATALANA Y LITERATURA"
      },
      {
        "code": "061",
        "name": "ECONOMIA"
      },
      {
        "code": "101",
        "name": "ADMINISTRACION DE EMPRESAS"
      },
      {
        "code": "102",
        "name": "ANALISIS Y QUIMICA INDUSTRIAL"
      },
      {
        "code": "103",
        "name": "ASESORIA Y PROCESOS DE IMAGEN PERSONAL"
      },
      {
        "code": "104",
        "name": "CONSTRUCCIONES CIVILES Y EDIFICACION"
      },
      {
        "code": "105",
        "name": "FORMACION Y ORIENTACION LABORAL"
      },
      {
        "code": "106",
        "name": "HOSTELERIA Y TURISMO"
      },
      {
        "code": "107",
        "name": "INFORMATICA"
      },
      {
        "code": "108",
        "name": "INTERVENCION SOCIOCOMUNITARIA"
      },
      {
        "code": "110",
        "name": "ORGANIZACION Y GESTION COMERCIAL"
      },
      {
        "code": "111",
        "name": "ORGANIZACION Y PROCESOS DE MANTENIMIENTO DE VEHICULOS"
      },
      {
        "code": "112",
        "name": "ORGANIZACION Y PROYECTOS DE FABRICACION MECANICA"
      },
      {
        "code": "113",
        "name": "ORGANIZACION Y PROYECTOS DE SISTEMAS ENERGETICOS"
      },
      {
        "code": "115",
        "name": "PROCESOS DE PRODUCCION AGRARIA"
      },
      {
        "code": "116",
        "name": "PROCESOS EN LA INDUSTRIA ALIMENTARIA"
      },
      {
        "code": "117",
        "name": "PROCESOS DIAGNOSTICOS CLINICOS Y PRODUCTOS ORTOPROTESICOS"
      },
      {
        "code": "118",
        "name": "PROCESOS SANITARIOS"
      },
      {
        "code": "119",
        "name": "PROCESOS Y MEDIOS DE COMUNICACION"
      },
      {
        "code": "120",
        "name": "PROCESOS Y PRODUCTOS DE TEXTIL, CONFECCION Y PIEL"
      },
      {
        "code": "122",
        "name": "PROCESOS Y PRODUCTOS EN ARTES GRAFICAS"
      },
      {
        "code": "123",
        "name": "PROCESOS Y PRODUCTOS EN MADERA Y MUEBLE"
      },
      {
        "code": "124",
        "name": "SISTEMAS ELECTRONICOS"
      },
      {
        "code": "125",
        "name": "SISTEMAS ELECTROTECNICOS Y AUTOMATICOS"
      },
      {
        "code": "205",
        "name": "INSTALACIÓN Y MANTENIMIENTO DE EQUIPOS TÉRMICOS Y DE FLUIDOS"
      },
      {
        "code": "206",
        "name": "INSTALACIONES ELECTROTÉCNICAS"
      },
      {
        "code": "208",
        "name": "LABORATORIO"
      },
      {
        "code": "212",
        "name": "OFICINA DE PROYECTOS DE CONSTRUCCIÓN"
      },
      {
        "code": "214",
        "name": "OPERACIONES Y EQUIPOS DE ELABORACIÓN DE PRODUCTOS ALIMENTARIOS"
      },
      {
        "code": "215",
        "name": "OPERACIONES DE PROCESOS"
      },
      {
        "code": "216",
        "name": "OPERACIONES Y EQUIPOS DE PRODUCCIÓN AGRARIA"
      },
      {
        "code": "219",
        "name": "PROCEDIMIENTOS DE DIAGNÓSTICO CLÍNICO Y ORTOPROTÉSICO"
      },
      {
        "code": "220",
        "name": "PROCEDIMIENTOS SANITARIOS Y ASISTENCIALES"
      },
      {
        "code": "221",
        "name": "PROCESOS COMERCIALES"
      },
      {
        "code": "222",
        "name": "PROCESOS DE GESTIÓN ADMINISTRATIVA"
      },
      {
        "code": "225",
        "name": "SERVICIOS A LA COMUNIDAD"
      },
      {
        "code": "227",
        "name": "SISTEMAS Y APLICACIONES INFORMÁTICAS"
      },
      {
        "code": "229",
        "name": "TÉCNICAS Y PROCEDIMIENTOS DE IMAGEN Y SONIDO"
      },
      {
        "code": "231",
        "name": "EQUIPOS ELECTRÓNICOS"
      }
    ]
  },
  {
    "code": "0592",
    "name": "PROFESORES DE ESCUELAS OFICIALES DE IDIOMAS",
    "especialidades": [
      {
        "code": "001",
        "name": "ALEMAN"
      },
      {
        "code": "003",
        "name": "CATALAN"
      },
      {
        "code": "006",
        "name": "ESPAÑOL"
      },
      {
        "code": "008",
        "name": "FRANCES"
      },
      {
        "code": "011",
        "name": "INGLES"
      },
      {
        "code": "012",
        "name": "ITALIANO"
      }
    ]
  },
  {
    "code": "0593",
    "name": "CATEDRÁTICOS DE MÚSICA Y ARTES ESCÉNICAS",
    "especialidades": [
      {
        "code": "001",
        "name": "ACORDEON"
      },
      {
        "code": "006",
        "name": "CANTO"
      },
      {
        "code": "008",
        "name": "CLARINETE"
      },
      {
        "code": "009",
        "name": "CLAVE"
      },
      {
        "code": "010",
        "name": "COMPOSICION"
      },
      {
        "code": "014",
        "name": "CONTRABAJO"
      },
      {
        "code": "023",
        "name": "DIRECCION DE ORQUESTA"
      },
      {
        "code": "030",
        "name": "FAGOT"
      },
      {
        "code": "031",
        "name": "FLAUTA DE PICO"
      },
      {
        "code": "032",
        "name": "FLAUTA TRAVESERA"
      },
      {
        "code": "035",
        "name": "GUITARRA"
      },
      {
        "code": "039",
        "name": "HISTORIA DE LA MUSICA"
      },
      {
        "code": "050",
        "name": "MUSICA DE CAMARA"
      },
      {
        "code": "057",
        "name": "PEDAGOGIA"
      },
      {
        "code": "058",
        "name": "PERCUSION"
      },
      {
        "code": "059",
        "name": "PIANO"
      },
      {
        "code": "061",
        "name": "IMPROVISACION Y ACOMPAÑAMIENTO"
      },
      {
        "code": "066",
        "name": "SAXOFON"
      },
      {
        "code": "075",
        "name": "TROMPETA"
      },
      {
        "code": "076",
        "name": "TUBA"
      },
      {
        "code": "077",
        "name": "VIOLA"
      },
      {
        "code": "078",
        "name": "VIOLIN"
      },
      {
        "code": "079",
        "name": "VIOLONCHELO"
      },
      {
        "code": "098",
        "name": "REPERTORIO CON PIANO PARA INSTRUMENTOS"
      }
    ]
  },
  {
    "code": "0594",
    "name": "PROFESORES DE MÚSICA Y ARTES ESCÉNICAS",
    "especialidades": [
      {
        "code": "403",
        "name": "CANTO"
      },
      {
        "code": "404",
        "name": "CLARINETE"
      },
      {
        "code": "406",
        "name": "CONTRABAJO"
      },
      {
        "code": "408",
        "name": "FAGOT"
      },
      {
        "code": "410",
        "name": "FLAUTA TRAVESERA"
      },
      {
        "code": "411",
        "name": "FLAUTA DE PICO"
      },
      {
        "code": "412",
        "name": "FUNDAMENTOS DE COMPOSICION"
      },
      {
        "code": "414",
        "name": "GUITARRA"
      },
      {
        "code": "416",
        "name": "HISTORIA DE LA MUSICA"
      },
      {
        "code": "417",
        "name": "INSTRUMENTOS DE CUERDA PULSADA DEL RENACIMIENTO Y BARROCO"
      },
      {
        "code": "418",
        "name": "INSTRUMENTOS DE PUA"
      },
      {
        "code": "419",
        "name": "OBOE"
      },
      {
        "code": "420",
        "name": "ORGANO"
      },
      {
        "code": "421",
        "name": "ORQUESTA"
      },
      {
        "code": "422",
        "name": "PERCUSION"
      },
      {
        "code": "423",
        "name": "PIANO"
      },
      {
        "code": "424",
        "name": "SAXOFON"
      },
      {
        "code": "426",
        "name": "TROMBON"
      },
      {
        "code": "427",
        "name": "TROMPA"
      },
      {
        "code": "428",
        "name": "TROMPETA"
      },
      {
        "code": "429",
        "name": "TUBA"
      },
      {
        "code": "431",
        "name": "VIOLA"
      },
      {
        "code": "433",
        "name": "VIOLIN"
      },
      {
        "code": "434",
        "name": "VIOLONCHELLO"
      },
      {
        "code": "460",
        "name": "LENGUAJE MUSICAL"
      }
    ]
  },
  {
    "code": "0595",
    "name": "PROFESORES DE ARTES PLÁSTICAS Y DISEÑO",
    "especialidades": [
      {
        "code": "503",
        "name": "CONSERVACIÓN Y RESTAURACIÓN DE OBRAS ESCULTÓRICAS"
      },
      {
        "code": "504",
        "name": "CONSERVACIÓN Y RESTAURACIÓN DE OBRAS PICTÓRICAS"
      },
      {
        "code": "507",
        "name": "DIBUJO ARTÍSTICO Y COLOR"
      },
      {
        "code": "508",
        "name": "DIBUJO TÉCNICO"
      },
      {
        "code": "509",
        "name": "DISEÑO DE INTERIORES"
      },
      {
        "code": "510",
        "name": "DISEÑO DE MODA"
      },
      {
        "code": "511",
        "name": "DISEÑO DE PRODUCTO"
      },
      {
        "code": "512",
        "name": "DISEÑO GRAFICO"
      },
      {
        "code": "515",
        "name": "FOTOGRAFÍA"
      },
      {
        "code": "516",
        "name": "HISTORIA DEL ARTE"
      },
      {
        "code": "517",
        "name": "JOYERÍA Y ORFEBRERÍA"
      },
      {
        "code": "519",
        "name": "MATERIALES Y TECNOLOGÍA: CONSERVACION Y RESTAURACION"
      },
      {
        "code": "520",
        "name": "MATERIALES Y TECNOLOGÍA: DISEÑO"
      },
      {
        "code": "521",
        "name": "MEDIOS AUDIOVISUALES"
      },
      {
        "code": "522",
        "name": "MEDIOS INFORMÁTICOS"
      },
      {
        "code": "523",
        "name": "ORGANIZACIÓN INDUSTRIAL Y LEGISLACIÓN"
      },
      {
        "code": "525",
        "name": "VOLUMEN"
      }
    ]
  },
  {
    "code": "0596",
    "name": "MAESTROS DE TALLER DE ARTES PLÁSTICAS Y DISEÑO",
    "especialidades": [
      {
        "code": "608",
        "name": "FOTOGRAFIA Y PROCESOS DE REPRODUCCION"
      },
      {
        "code": "610",
        "name": "MOLDES Y REPRODUCCIONES"
      },
      {
        "code": "612",
        "name": "TALLA EN PIEDRA Y MADERA"
      },
      {
        "code": "613",
        "name": "TECNICAS CERAMICAS"
      },
      {
        "code": "614",
        "name": "TECNICAS DE GRABADO Y ESTAMPACION"
      },
      {
        "code": "618",
        "name": "TECNICAS DEL METAL"
      }
    ]
  },
  {
    "code": "0598",
    "name": "PROFESORES ESPECIALISTAS EN SECTORES",
    "especialidades": [
      {
        "code": "001",
        "name": "COCINA Y PASTELERÍA"
      },
      {
        "code": "002",
        "name": "ESTÉTICA"
      },
      {
        "code": "003",
        "name": "FABRICACIÓN E INSTALACIÓN DE CARPINTERÍA Y MUEBLE"
      },
      {
        "code": "004",
        "name": "MANTENIMIENTO DE VEHÍCULOS"
      },
      {
        "code": "005",
        "name": "MECANIZADO Y MANTENIMIENTO DE MÁQUINAS"
      },
      {
        "code": "006",
        "name": "PATRONAJE Y CONFECCIÓN"
      },
      {
        "code": "007",
        "name": "PELUQUERÍA"
      },
      {
        "code": "008",
        "name": "PRODUCCIÓN DE ARTES GRÁFICAS"
      },
      {
        "code": "009",
        "name": "SERVICIOS DE RESTAURACIÓN"
      },
      {
        "code": "010",
        "name": "SOLDADURA"
      }
    ]
  }
];
