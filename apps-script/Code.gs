// ==========================================================
// TUMO Barracas — FlashLabs diciembre 2026
// Back de inscripciones en Google Sheets + Apps Script
//
// Pegar en: Planilla > Extensiones > Apps Script
// Primera vez: ejecutar setup() (o menú FlashLabs > Configurar planilla).
// Ver SETUP.md para los pasos completos.
// ==========================================================

const TAB = {
  ACT: "Actividades",
  EST: "Estudiantes",
  SOL: "Solicitudes",
  HIS: "Historial",
  MSG: "Mensajes",
  CFG: "Config",
  RES: "Resumen",
  MAN: "Estudiantes manuales",
  SYNC: "Sync",
};

// Columnas fijas de Estudiantes. La sincronización agrega después las columnas de cursos del 360
// (Music_I, Programming_II, …) tal como vienen.
const STUDENT_BASE = ["DNI", "Tipo doc", "TUMO ID", "Nombre", "Apellido", "Email", "Email 2", "Estado 360", "Datos 360"];

// El código busca las columnas por nombre: se pueden reordenar o agregar columnas nuevas.
const HEADERS = {
  Actividades: ["ID", "Actividad", "Tipo", "Grupo", "Habilitado", "Inscripción", "Días", "Horario",
    "Capacidad", "Requisito", "Columna requisito", "Valor requerido", "Descripción", "Herramientas", "Imagen", "Docentes"],
  Estudiantes: STUDENT_BASE,
  "Estudiantes manuales": STUDENT_BASE,
  Solicitudes: ["ID", "Fecha", "DNI", "TUMO ID", "Nombre ingresado", "Nombre 360", "Email", "Actividad ID",
    "Actividad", "Grupo", "Estado", "Prioridad", "Validación", "Motivo", "Vence invitación", "Token", "Actualizado", "Notas"],
  Historial: ["Fecha", "Usuario", "Solicitud", "DNI", "Antes", "Después", "Detalle"],
  Mensajes: ["Clave", "Asunto", "Cuerpo"],
  Config: ["Clave", "Valor", "Descripción"],
  Sync: ["Fecha", "Usuario", "Filas origen", "Estudiantes", "Con cursos (360)", "Sin TUMO ID",
    "TUMO ID sin 360", "Duplicados", "Filas ignoradas", "Manuales", "Segundos", "Detalle"],
};

const ESTADO = {
  RECIBIDA: "Recibida",
  VALIDACION: "En validación",
  PENDIENTE: "Pendiente de confirmación",
  CONFIRMADA: "Confirmada",
  ESPERA: "Lista de espera",
  OFRECIDA: "Vacante ofrecida",
  CANCELADA: "Cancelada",
  NO_ELEGIBLE: "No elegible",
  FINALIZADA: "Finalizada",
};
const ESTADOS = Object.keys(ESTADO).map((k) => ESTADO[k]);
// Una solicitud "activa" impide pedir otra actividad
const ACTIVOS = [ESTADO.RECIBIDA, ESTADO.VALIDACION, ESTADO.PENDIENTE, ESTADO.CONFIRMADA, ESTADO.ESPERA, ESTADO.OFRECIDA];
// Estas ocupan lugar: cuando suman la capacidad, las nuevas solicitudes van a lista de espera
const OCUPAN = [ESTADO.PENDIENTE, ESTADO.CONFIRMADA, ESTADO.OFRECIDA];

// Se puede pedir vacante aunque no se cumplan los requisitos: queda con menos prioridad.
// El equipo ordena Solicitudes por Prioridad y después por Fecha.
const PRIORIDAD = { CUMPLE: "1 · Cumple requisitos", SIN_VERIFICAR: "2 · Sin verificar", NO_CUMPLE: "3 · No cumple requisitos" };
const priorityOf_ = (s) => Number(String(s["Prioridad"] || "1").charAt(0)) || 1; // filas viejas sin prioridad = 1

// Lo que ve el estudiante para cada estado interno
const ESTADO_PUBLICO = {
  "Recibida": "Recibimos tu solicitud",
  "En validación": "Estamos validando tus datos",
  "Pendiente de confirmación": "Estamos revisando tu vacante",
  "Confirmada": "¡Tenés tu vacante confirmada!",
  "Lista de espera": "Estás en lista de espera",
  "Vacante ofrecida": "¡Se liberó una vacante para vos! Revisá tu mail",
  "Cancelada": "Tu solicitud fue cancelada",
  "No elegible": "Tu solicitud no cumple los requisitos",
  "Finalizada": "La actividad finalizó",
};

// ---------- Datos iniciales (de "Cronograma FlashLabs") ----------

const DIAS_DICIEMBRE = "Jue 10, Vie 11, Mar 15 y Jue 17 de diciembre (Vie 18: cierre y recuperatorio)";

const SEED_ACTIVIDADES = [
  // id base, nombre, docentes, horario grupo A, horario grupo B (vacío = sin grupo B)
  ["musica-cine", "Composición de Música para Cine", "Mati C", "9:00 a 11:00", "14:00 a 16:00"],
  ["tumogotchi", "TumoGotchi", "Santi", "9:00 a 11:00", "14:00 a 16:00"],
  ["animacion-gifs", "Animación de gifs", "Oli", "9:00 a 11:00", "14:00 a 16:00"],
  ["juego-cartas", "Creación juego de cartas", "Mati G, Agos, Gero", "9:00 a 11:00", "14:00 a 16:00"],
  ["carreras-iot", "Carreras con IOT", "Elu", "9:00 a 11:00", "14:00 a 16:00"],
  ["sonido-codigo", "Del Sonido al Código", "Guido, Palo", "14:00 a 16:00", "17:00 a 19:00"],
  ["personajes-ia-3d", "Personajes IA en 3D", "Emi, Tade", "14:00 a 16:00", "17:00 a 19:00"],
  ["tumo-tank", "TUMO TANK", "Chichi, Marcos, Marian, Mati C", "17:00 a 19:00", ""],
];

const SEED_CONFIG = [
  ["Inscripción abierta", "SÍ", "SÍ / NO. Abre o cierra todas las inscripciones a la vez."],
  ["Capacidad por grupo", 20, "Valor por defecto al crear actividades (cada grupo se puede cambiar en Actividades)."],
  ["Modo prueba: enviar todos los mails a", "", "Si tiene un mail, TODOS los mails van ahí en lugar de al estudiante. Vaciar para producción."],
  ["Plazo invitación (horas)", 48, "Tiempo para aceptar una vacante ofrecida desde la lista de espera."],
  ["Contacto", "", "Mail o teléfono que se muestra cuando algo no se puede resolver en la web."],
  ["Web: mostrar detalle de requisitos", "SÍ", "SÍ / NO. Muestra en el formulario qué cursos del requisito tiene aprobados el documento ingresado."],
  // Origen de los estudiantes (ver syncStudents)
  ["Origen estudiantes: planilla (ID o link)", "", "Planilla con las pestañas de inscripciones (back) y 360. Sólo hace falta que el dueño de este script pueda abrirla."],
  ["Origen: pestaña inscripciones", "back", "Pestaña con documento + TUMO ID + nombre + mails."],
  ["Origen: pestaña 360", "360", "Pestaña del 360 (fila 1 = títulos: TumoID, Status, Music_I, …)."],
  ["Origen back: columna documento", "P", "Letra de la columna del documento del estudiante."],
  ["Origen back: columna tipo de documento", "O", "DNI / PAS / Otro."],
  ["Origen back: columna TUMO ID", "L", ""],
  ["Origen back: columna apellido", "M", ""],
  ["Origen back: columna nombre", "N", ""],
  ["Origen back: columna email", "F", "Mail real de contacto."],
  ["Origen back: columna email 2", "G", "Segundo mail (opcional)."],
];

// Datos de "Flash Labs" (descripciones, requisitos y cupos). Se cargan con el menú
// FlashLabs > Actualizar descripciones y requisitos. null = no tocar esa columna.
// Columna requisito: columnas del 360 unidas con " o " (alcanza una) o " y " (hacen falta todas).
const CATALOGO = {
  "musica-cine": {
    nombre: "Composición de Música para Cine",
    descripcion: "Vas a ver un poco de teoría e historia de las bandas sonoras y vas a llevar adelante la producción musical de un cortometraje de un minuto aproximadamente.",
    requisito: "Tener Nivel 1 de Música aprobado", regla: "Music_I", valor: "Completed",
    capacidad: 18, herramientas: "Logic Pro",
  },
  "sonido-codigo": {
    nombre: "Del sonido al código",
    descripcion: "Cada grupo desarrolla un pequeño software de visualización a partir de sonidos que produce en Logic Pro y procesa con código.",
    requisito: "Tener Nivel 2 de Programación o Nivel 2 de Música aprobado", regla: "Programming_II o Music_II", valor: "Completed",
    capacidad: 18, herramientas: "Logic Pro y Visual Studio Code",
  },
  "tumogotchi": {
    nombre: "TumoGotchi",
    descripcion: "Creás tu propio personaje y lo convertís en un TumoGotchi programado desde cero con JavaScript e inteligencia artificial: un temporizador que consume sus recursos, estados de ánimo (feliz, hambriento, dormido), un inventario de alimentos y un historial para interactuar con él.",
    requisito: "", regla: "", valor: "", capacidad: 18, herramientas: "Visual Studio Code",
  },
  "animacion-gifs": {
    nombre: "Animación de gifs",
    descripcion: "Diseñás un personaje propio (o elegís uno que ya exista) y lo transformás en un pack de stickers animados que muestran distintas acciones o emociones.",
    requisito: "", regla: "", valor: "", capacidad: 18, herramientas: "Harmony Toon Boom y tabletas Wacom",
  },
  "juego-cartas": {
    nombre: "Creación de cartas",
    descripcion: "En grupo, creás un juego de cartas y un dado, y aprendés a balancear las mecánicas que inventen usando patrones de game design.",
    requisito: "Diseño Gráfico 1 y Modelado 3D 1 aprobados (Videojuegos 1 recomendado)", regla: "Graphic_Design_I y 3D_Modeling_I", valor: "Completed",
    capacidad: 18, herramientas: "Illustrator y Maya",
  },
  "tumo-tank": {
    nombre: "TUMO Tank",
    descripcion: "4 clases (8 horas) en las que 8 equipos de 4 crean un juego arcade multijugador desde cero y arman su propio joystick físico con Arduino. La propuesta es asistir a las 4 clases.",
    requisito: "Tener Nivel 1 aprobado en Robótica, Diseño Gráfico, Videojuegos o Música (alcanza con uno)",
    regla: "Robotics_I o Graphic_Design_I o Game_Development_I o Music_I", valor: "Completed",
    capacidad: 32, herramientas: "Illustrator, Arduino, Unity y Logic Pro",
  },
  "carreras-iot": {
    nombre: "Creación de juegos en el Carrier IoT",
    descripcion: "Un ciclo de 4 clases de 2 horas para desarrollar un videojuego sencillo, al estilo de Falling Bananas o Dino Run, directamente sobre las placas del taller de robótica.",
    requisito: "", regla: "", valor: "", capacidad: 12, herramientas: "Arduino Cloud y Kit Carrier IoT",
  },
  "personajes-ia-3d": {
    nombre: "Generación de Personajes 3D",
    descripcion: "4 encuentros para combinar IA generativa y 3D: creás un personaje, lo llevás a Blender y trabajás composición, iluminación y cámara hasta un render final. Si el tiempo alcanza, lo animás con IA generativa.",
    requisito: "", regla: "", valor: "", capacidad: 18, herramientas: "Blender, Poly Haven, Meshy, TumoAI, Kling AI y Gemini Pro", // 1 por computadora
  },
};

const SEED_MENSAJES = [
  ["RECEPCION", "Recibimos tu solicitud para {actividad}",
    "¡Hola {nombre}!\n\nRecibimos tu solicitud para {actividad} (grupo {grupo}).\n{dias}, {horario}.\n\n" +
    "Importante: tu vacante todavía NO está confirmada. Pronto nos vamos a contactar con vos.\n\n¡Gracias!\nTUMO Barracas"],
  ["CONFIRMADA", "¡Tu vacante en {actividad} está confirmada!",
    "¡Hola {nombre}!\n\nTu vacante en {actividad} (grupo {grupo}) está confirmada.\n\n" +
    "Días: {dias}\nHorario: {horario}\nLugar: TUMO Barracas\n\nEs importante asistir a todas las sesiones.\n\n¡Te esperamos!\nTUMO Barracas"],
  ["ESPERA", "Estás en lista de espera para {actividad}",
    "¡Hola {nombre}!\n\nPor ahora no hay vacantes en {actividad} (grupo {grupo}), así que quedaste en lista de espera.\n" +
    "Todavía no tenés una vacante. Si se libera una, te vamos a escribir a este mail.\n\nTUMO Barracas"],
  ["CANCELADA", "Tu solicitud para {actividad} fue cancelada",
    "¡Hola {nombre}!\n\nTu solicitud para {actividad} (grupo {grupo}) fue cancelada.\n" +
    "Si creés que es un error, escribinos a {contacto}.\n\nTUMO Barracas"],
  ["NO_ELEGIBLE", "Sobre tu solicitud para {actividad}",
    "¡Hola {nombre}!\n\nRevisamos tu solicitud para {actividad} y no cumple los requisitos de la actividad.\n" +
    "Si tenés dudas, escribinos a {contacto}.\n\nTUMO Barracas"],
];

// Sólo para planillas nuevas: la primera sincronización los reemplaza por los estudiantes reales
const SEED_ESTUDIANTES_PRUEBA = [
  // DNI, Tipo doc, TUMO ID, Nombre, Apellido, Email, Email 2, Estado 360, Datos 360, Programming_I
  ["40000001", "DNI", "T-0001", "Martina", "Gómez", "martina@example.com", "", "Active", "OK", "Completed"],
  ["40000002", "DNI", "T-0002", "Tomás", "Rodríguez", "tomas@example.com", "", "Active", "OK", "Completed ⭐"],
  ["40000003", "DNI", "T-0003", "Lucía", "Pérez", "lucia@example.com", "", "Active", "OK", "Prerequisite Not Done"],
  ["40000004", "DNI", "T-0004", "Benjamín", "Sosa", "benja@example.com", "", "Active", "OK", "Prerequisite Conditional"],
  ["40000005", "DNI", "T-0005", "Sofía", "López", "", "", "Freeze", "OK", "Completed"],
];

// ==========================================================
// Acceso a la planilla
// ==========================================================

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

// Cada pestaña se lee una sola vez por pedido. Actividades y Config además se guardan
// 30 s en caché (cambian poco): los cambios del equipo ahí tardan hasta 30 s en verse en la web.
let MEMO = {};
function resetMemo_() { MEMO = {}; }
const CACHED_TABS = ["Actividades", "Config"];

function table_(name) {
  if (MEMO[name]) return MEMO[name];
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error("Falta la pestaña " + name + ". Ejecutá setup().");
  const cache = CACHED_TABS.indexOf(name) >= 0 ? CacheService.getScriptCache() : null;
  const hit = cache && cache.get("tab:" + name);
  const values = hit ? JSON.parse(hit) : sh.getDataRange().getValues();
  if (cache && !hit) {
    try { cache.put("tab:" + name, JSON.stringify(values), 30); } catch (err) { /* demasiado grande */ }
  }
  const headers = values.shift().map((h) => String(h).trim());
  const rows = values.map((v, i) => {
    const row = { _row: i + 2 };
    headers.forEach((h, j) => { row[h] = v[j]; });
    return row;
  });
  MEMO[name] = { sh: sh, headers: headers, rows: rows };
  return MEMO[name];
}

// Después de escribir en Actividades/Config desde el script (setup), la caché queda vieja
function forget_(name) {
  delete MEMO[name];
  if (CACHED_TABS.indexOf(name) >= 0) CacheService.getScriptCache().remove("tab:" + name);
}

function setCells_(t, row, changes) {
  Object.keys(changes).forEach((key) => {
    const col = t.headers.indexOf(key);
    if (col < 0) throw new Error("Falta la columna " + key + " en " + t.sh.getName());
    t.sh.getRange(row._row, col + 1).setValue(changes[key]);
    row[key] = changes[key];
  });
}

function append_(t, obj) {
  t.sh.appendRow(t.headers.map((h) => (obj[h] === undefined ? "" : obj[h])));
}

function config_() {
  const cfg = {};
  table_(TAB.CFG).rows.forEach((r) => { cfg[String(r["Clave"]).trim()] = r["Valor"]; });
  return cfg;
}

// ---------- Utilidades ----------

const norm_ = (v) => String(v === undefined || v === null ? "" : v)
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
// Documento (DNI, pasaporte u otro): sólo letras y números, en mayúsculas ("40.123.456" → "40123456")
const dni_ = (v) => String(v === undefined || v === null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const isDoc_ = (doc) => /^[A-Z0-9]{6,12}$/.test(doc) && /\d/.test(doc);
const YES = ["si", "yes", "true", "x", "1", "ok", "completado", "completada", "completo", "aprobado"];
const NO = ["no", "false", "0", "pendiente", "incompleto"];
const isYes_ = (v) => v === true || YES.indexOf(norm_(v)) >= 0;
const isNo_ = (v) => v === false || NO.indexOf(norm_(v)) >= 0;

// ---------- Requisitos ----------
// Valores del 360: "Completed", "Completed ⭐", "Prerequisite Done", "Prerequisite Conditional", "Prerequisite Not Done".
// "Valor requerido" vacío o "Completed" → hay que haberlo aprobado. "Prerequisite Done" → alcanza con estar habilitado.
// También acepta columnas propias con SÍ / NO.
function courseCheck_(value, required) {
  const v = norm_(value);
  if (!v) return "unknown";
  if (v.indexOf("completed") === 0 || isYes_(value)) return "ok";
  if (v.indexOf("prerequisite done") === 0) return norm_(required).indexOf("prerequisite done") === 0 ? "ok" : "no";
  if (v.indexOf("prerequisite not done") === 0 || isNo_(value)) return "no";
  return "unknown"; // "Prerequisite Conditional" u otro valor: lo revisa el equipo
}

// "Columna requisito": "Music_I" · "Programming_II o Music_II" (alcanza una) · "Graphic_Design_I y 3D_Modeling_I" (todas)
// Devuelve null si no hay requisito, o { modo: "any" | "all", cursos: [{ col, header, value, result }] }
function requirementParts_(act, student, headers) {
  const rule = String(act["Columna requisito"] || "").trim();
  if (!rule) return null;
  const cursos = rule.split(/\s+[oy]\s+|[|&,]/i).map((c) => c.trim()).filter(Boolean).map((col) => {
    const header = headers.find((h) => norm_(h) === norm_(col));
    const value = header ? String(student[header] || "").trim() : "";
    return { col: col, header: header, value: value, result: header ? courseCheck_(value, act["Valor requerido"]) : "unknown" };
  });
  return { modo: /\s+o\s+|\|/i.test(rule) ? "any" : "all", cursos: cursos };
}

// Devuelve "ok" | "no" | "unknown". Sin datos del 360 (sin TUMO ID) → "unknown".
function requirement_(act, student, headers) {
  const parts = requirementParts_(act, student, headers);
  if (!parts) return "ok";
  const results = parts.cursos.map((c) => c.result);
  if (parts.modo === "any") return results.indexOf("ok") >= 0 ? "ok" : results.indexOf("unknown") >= 0 ? "unknown" : "no";
  return results.indexOf("no") >= 0 ? "no" : results.indexOf("unknown") >= 0 ? "unknown" : "ok";
}

// Para el equipo: qué valor tiene cada curso del requisito. Ej. "Robotics_I: Completed · Music_I: Prerequisite Not Done"
function requirementDetail_(act, student, headers) {
  const parts = requirementParts_(act, student, headers);
  if (!parts) return "sin requisito";
  if (student["Datos 360"] && student["Datos 360"] !== "OK") return "sin datos del 360 (" + student["Datos 360"] + ")";
  return parts.cursos.map((c) => c.col + ": " + (!c.header ? "no existe esa columna" : c.value || "vacío")).join(" · ");
}

// Nombre legible de un curso del 360: "Graphic_Design_I" → "Diseño Gráfico 1"
const COURSE_NAMES = {
  Music: "Música", Programming: "Programación", Robotics: "Robótica", Graphic_Design: "Diseño Gráfico",
  Game_Development: "Videojuegos", "3D_Modeling": "Modelado 3D", Animation: "Animación", Filmmaking: "Cine",
  Photography: "Fotografía", Motion_Graphics: "Motion Graphics", GenAI: "IA generativa", Web_Development: "Desarrollo web",
};
function courseLabel_(col) {
  const m = String(col).match(/^(.*)_(I|II|III|IV)$/);
  if (!m) return String(col).replace(/_/g, " ");
  return (COURSE_NAMES[m[1]] || m[1].replace(/_/g, " ")) + " " + { I: 1, II: 2, III: 3, IV: 4 }[m[2]];
}

// Lo que ve el estudiante en la web: sólo los cursos del requisito de ESA actividad (nunca todo su historial).
// Se apaga con Config > "Web: mostrar detalle de requisitos" = NO.
function publicRequirements_(act, student, headers) {
  const show = config_()["Web: mostrar detalle de requisitos"];
  if (show !== undefined && show !== "" && !isYes_(show)) return null;
  const parts = requirementParts_(act, student, headers);
  if (!parts) return null;
  const sinDatos = Boolean(student["Datos 360"] && student["Datos 360"] !== "OK");
  return {
    modo: parts.modo,
    sinHistorial: sinDatos,
    cursos: parts.cursos.map((c) => ({ curso: courseLabel_(c.col), estado: c.result })),
  };
}

// Busca un estudiante por documento sin leer toda la pestaña (con ~2000 filas es bastante más rápido)
function findStudent_(doc) {
  const sh = ss_().getSheetByName(TAB.EST);
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map((h) => String(h).trim());
  const col = headers.indexOf("DNI") + 1;
  if (!col || sh.getLastRow() < 2) return null;
  const cell = sh.getRange(2, col, sh.getLastRow() - 1, 1).createTextFinder(doc).matchEntireCell(true).findNext();
  if (!cell) return null;
  const values = sh.getRange(cell.getRow(), 1, 1, lastCol).getDisplayValues()[0];
  const student = { _row: cell.getRow() };
  headers.forEach((h, j) => { student[h] = values[j]; });
  return { student: student, headers: headers };
}

function fill_(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

// ==========================================================
// Cartelera y disponibilidad
// ==========================================================

function availability_(act, solicitudes, cfg) {
  const mine = solicitudes.filter((s) => s["Actividad ID"] === act["ID"]);
  const count = (estados) => mine.filter((s) => estados.indexOf(s["Estado"]) >= 0).length;
  const capacidad = Number(act["Capacidad"]) || 0;
  // Ocupan lugar las confirmadas/ofrecidas y las pendientes que cumplen requisitos:
  // una solicitud que no los cumple nunca manda a lista de espera a una que sí.
  const ocupadas = mine.filter((s) => s["Estado"] === ESTADO.CONFIRMADA || s["Estado"] === ESTADO.OFRECIDA ||
    (s["Estado"] === ESTADO.PENDIENTE && priorityOf_(s) === 1)).length;
  const inscripcion = norm_(act["Inscripción"]);

  let estado = "abierta";
  if (!isYes_(cfg["Inscripción abierta"]) || inscripcion === "cerrada") estado = "cerrada";
  else if (inscripcion === "lista de espera" || ocupadas >= capacidad) estado = "espera";

  return {
    estado: estado,
    libres: Math.max(0, capacidad - ocupadas),
    confirmadas: count([ESTADO.CONFIRMADA]),
    enEspera: count([ESTADO.ESPERA]),
  };
}

function publicActivities_() {
  const cfg = config_();
  const solicitudes = table_(TAB.SOL).rows;
  return table_(TAB.ACT).rows
    .filter((a) => a["ID"] && isYes_(a["Habilitado"]))
    .map((a) => {
      const disp = availability_(a, solicitudes, cfg);
      return {
        id: a["ID"],
        nombre: a["Actividad"],
        tipo: a["Tipo"],
        grupo: a["Grupo"],
        dias: a["Días"],
        horario: a["Horario"],
        capacidad: Number(a["Capacidad"]) || 0,
        requisito: a["Requisito"] || "",
        descripcion: a["Descripción"] || "",
        herramientas: a["Herramientas"] || "",
        imagen: a["Imagen"] || "",
        estado: disp.estado,
        libres: disp.libres,
      };
    });
}

// ==========================================================
// Verificación (en tiempo real y antes de registrar)
// ==========================================================
// La identidad se valida sólo por DNI: el nombre se guarda como lo escribió el estudiante
// (para que el equipo lo vea al lado del "Nombre 360"), pero no se compara.
// Devuelve sólo códigos: nunca datos personales de otra persona.
//   ok            → puede continuar (lugar: "vacante" | "espera")
//   sin_verificar → no se pudo comprobar un requisito: se registra "En validación"
//   dni_invalido | no_encontrado | activa | no_cumple | cerrada | actividad_invalida

function verify_(dni, actividadId) {
  dni = dni_(dni);
  if (!isDoc_(dni)) return { status: "dni_invalido" };

  const found = findStudent_(dni);
  if (!found) return { status: "no_encontrado" };
  const student = found.student;

  const solicitudes = table_(TAB.SOL).rows;
  if (solicitudes.some((s) => dni_(s["DNI"]) === dni && ACTIVOS.indexOf(s["Estado"]) >= 0)) {
    return { status: "activa" };
  }

  if (!actividadId) return { status: "ok", student: student };
  const act = table_(TAB.ACT).rows.find((a) => a["ID"] === actividadId && isYes_(a["Habilitado"]));
  if (!act) return { status: "actividad_invalida" };
  const disp = availability_(act, solicitudes, config_());
  if (disp.estado === "cerrada") return { status: "cerrada" };

  const result = {
    student: student, act: act, lugar: disp.estado === "espera" ? "espera" : "vacante",
    detalle: requirementDetail_(act, student, found.headers),
    requisitos: publicRequirements_(act, student, found.headers),
  };
  const req = requirement_(act, student, found.headers);
  if (req === "ok") return Object.assign(result, { status: "ok" });
  return Object.assign(result, { status: req === "no" ? "no_cumple" : "sin_verificar", motivo: act["Requisito"] });
}

function publicVerify_(r) {
  const out = { status: r.status };
  if (r.lugar && (r.status === "ok" || r.status === "sin_verificar")) out.lugar = r.lugar;
  if (r.motivo) out.motivo = String(r.motivo);
  if (r.requisitos) out.requisitos = r.requisitos;
  return out;
}

// ==========================================================
// Registrar solicitud
// ==========================================================

function register_(data) {
  if (data.confirmado !== true) return { status: "sin_confirmar" };
  if (!String(data.nombre || "").trim()) return { status: "falta_nombre" };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { status: "ocupado" };
  try {
    // Se repite todo dentro del lock: evita duplicados y que dos personas tomen la última vacante
    const r = verify_(data.dni, data.actividad);
    // No cumplir los requisitos no bloquea: se registra con prioridad 3
    if (["ok", "sin_verificar", "no_cumple"].indexOf(r.status) < 0) return publicVerify_(r);

    const estado = r.status === "sin_verificar" ? ESTADO.VALIDACION
      : r.lugar === "espera" ? ESTADO.ESPERA : ESTADO.PENDIENTE;
    const prioridad = { ok: PRIORIDAD.CUMPLE, sin_verificar: PRIORIDAD.SIN_VERIFICAR, no_cumple: PRIORIDAD.NO_CUMPLE }[r.status];
    const validacion = { ok: "Requisitos OK", sin_verificar: "Requisito sin verificar", no_cumple: "No cumple requisitos" }[r.status];
    const sol = table_(TAB.SOL);
    const id = "S-" + Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "yyMMdd") + "-" +
      Utilities.getUuid().slice(0, 6).toUpperCase();
    const row = {
      "ID": id,
      "Fecha": new Date(),
      "DNI": dni_(data.dni),
      "TUMO ID": r.student["TUMO ID"],
      "Nombre ingresado": String(data.nombre).trim(),
      "Nombre 360": r.student["Nombre"] + " " + r.student["Apellido"],
      "Email": [r.student["Email"], r.student["Email 2"]].map((m) => String(m || "").trim()).filter(Boolean).join(", "),
      "Actividad ID": r.act["ID"],
      "Actividad": r.act["Actividad"],
      "Grupo": r.act["Grupo"],
      "Estado": estado,
      "Prioridad": prioridad,
      "Validación": "Identidad OK · " + validacion + " (" + r.detalle + ")",
      "Motivo": r.status === "sin_verificar" ? "Verificar a mano: " + (r.motivo || "requisito")
        : r.status === "no_cumple" ? "Prioridad baja, no cumple: " + (r.motivo || "requisito") : "",
      "Token": Utilities.getUuid(),
      "Actualizado": new Date(),
    };
    append_(sol, row);
    log_(row, "", estado, "Solicitud recibida desde la web");
    sendTemplate_("RECEPCION", row, r.act);
    return { status: "ok", estado: estado, mensaje: ESTADO_PUBLICO[estado], cumple: r.status === "ok" };
  } finally {
    lock.releaseLock();
  }
}

function publicStatus_(dni) {
  dni = dni_(dni);
  const mine = table_(TAB.SOL).rows.filter((s) => dni_(s["DNI"]) === dni);
  const active = mine.filter((s) => ACTIVOS.indexOf(s["Estado"]) >= 0).pop();
  const last = active || mine.pop();
  if (!last) return { status: "no_encontrado" };
  return { status: "ok", estado: last["Estado"], mensaje: ESTADO_PUBLICO[last["Estado"]] || last["Estado"] };
}

// ==========================================================
// API web (la llama /api/inscripcion en Vercel)
// ==========================================================

function authorized_(key) {
  const secret = PropertiesService.getScriptProperties().getProperty("API_SECRET");
  return secret && key === secret;
}

function doGet(e) {
  resetMemo_();
  const p = e.parameter || {};
  if (!authorized_(p.key)) return json_({ status: "no_autorizado" });
  try {
    if (p.action === "actividades") return json_({ status: "ok", actividades: publicActivities_() });
    if (p.action === "verificar") return json_(publicVerify_(verify_(p.dni, p.actividad)));
    if (p.action === "estado") return json_(publicStatus_(p.dni));
    return json_({ status: "accion_invalida" });
  } catch (err) {
    console.error(err);
    return json_({ status: "error" });
  }
}

function doPost(e) {
  resetMemo_();
  try {
    const data = JSON.parse(e.postData.contents);
    if (!authorized_(data.key)) return json_({ status: "no_autorizado" });
    if (data.action === "solicitud") return json_(register_(data));
    return json_({ status: "accion_invalida" });
  } catch (err) {
    console.error(err);
    return json_({ status: "error" });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================
// Cambios del equipo en la planilla (trigger "Al editar" instalable)
// ==========================================================

function onSheetEdit(e) {
  resetMemo_();
  const sh = e.range.getSheet();
  if (sh.getName() !== TAB.SOL) return;
  const sol = table_(TAB.SOL);
  const col = sol.headers.indexOf("Estado") + 1;
  if (e.range.getColumn() > col || e.range.getLastColumn() < col) return;

  const acts = table_(TAB.ACT).rows;
  for (let r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    const row = sol.rows.find((x) => x._row === r);
    if (!row) continue;
    const before = e.range.getNumRows() === 1 ? (e.oldValue || "") : "?";
    const after = row["Estado"];
    if (after === before) continue;

    if (ESTADOS.indexOf(after) < 0) {
      setCells_(sol, row, { "Estado": before === "?" ? ESTADO.PENDIENTE : before });
      ss_().toast("\"" + after + "\" no es un estado válido.", "FlashLabs", 6);
      continue;
    }

    const act = acts.find((a) => a["ID"] === row["Actividad ID"]);
    if (after === ESTADO.CONFIRMADA && act) {
      const confirmadas = sol.rows.filter((s) => s._row !== r && s["Actividad ID"] === act["ID"] &&
        s["Estado"] === ESTADO.CONFIRMADA).length;
      if (confirmadas >= (Number(act["Capacidad"]) || 0)) {
        const back = before && before !== "?" ? before : ESTADO.PENDIENTE;
        setCells_(sol, row, { "Estado": back });
        ss_().toast("Capacidad completa en " + act["Actividad"] + " " + act["Grupo"] + ". No se confirmó.", "FlashLabs", 8);
        log_(row, after, back, "Rechazado: capacidad completa");
        continue;
      }
    }

    setCells_(sol, row, { "Actualizado": new Date() });
    log_(row, before, after, "Cambio manual");
    const template = { "Confirmada": "CONFIRMADA", "Lista de espera": "ESPERA", "Cancelada": "CANCELADA", "No elegible": "NO_ELEGIBLE" }[after];
    if (template) sendTemplate_(template, row, act);
  }
}

// ==========================================================
// Historial y mails
// ==========================================================

function log_(row, before, after, detail) {
  let user = "web";
  try { user = Session.getActiveUser().getEmail() || "web"; } catch (err) { /* sin permiso */ }
  append_(table_(TAB.HIS), {
    "Fecha": new Date(), "Usuario": user, "Solicitud": row["ID"], "DNI": row["DNI"],
    "Antes": before, "Después": after, "Detalle": detail,
  });
}

function sendTemplate_(key, row, act) {
  const msg = table_(TAB.MSG).rows.find((m) => m["Clave"] === key);
  if (!msg) return;
  const cfg = config_();
  const testTo = String(cfg["Modo prueba: enviar todos los mails a"] || "").trim();
  const to = testTo || String(row["Email"] || "").trim();
  if (!to) {
    log_(row, row["Estado"], row["Estado"], "Mail " + key + " no enviado: el estudiante no tiene email");
    return;
  }
  const vars = {
    nombre: String(row["Nombre 360"] || row["Nombre ingresado"]).split(" ")[0],
    actividad: row["Actividad"],
    grupo: row["Grupo"],
    dias: act ? act["Días"] : "",
    horario: act ? act["Horario"] : "",
    contacto: cfg["Contacto"] || "TUMO Barracas",
  };
  const subject = (testTo ? "[PRUEBA → " + row["Email"] + "] " : "") + fill_(msg["Asunto"], vars);
  MailApp.sendEmail({ to: to, subject: subject, body: fill_(msg["Cuerpo"], vars), name: "TUMO Barracas" });
}

// ==========================================================
// Configuración inicial
// ==========================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu("FlashLabs")
    .addItem("Sincronizar estudiantes ahora", "syncStudents")
    .addItem("Revisar un documento…", "diagnoseStudent")
    .addItem("Actualizar descripciones y requisitos", "applyCatalog")
    .addSeparator()
    .addItem("Configurar / reparar planilla", "setup")
    .addItem("Ver clave de la API", "showSecret")
    .addToUi();
}

function setup() {
  resetMemo_();
  const ss = ss_();
  Object.keys(HEADERS).forEach((name) => ensureTab_(name, HEADERS[name]));
  Object.keys(TAB).forEach((k) => forget_(TAB[k]));

  if (table_(TAB.CFG).rows.length === 0) {
    const sh = ss.getSheetByName(TAB.CFG);
    SEED_CONFIG.forEach((r) => sh.appendRow(r));
    // Mientras se prueba, todos los mails van al dueño de la planilla
    sh.getRange(4, 2).setValue(Session.getEffectiveUser().getEmail());
    forget_(TAB.CFG);
  } else {
    // Planillas ya instaladas: agrega las claves nuevas sin tocar las existentes
    const existing = table_(TAB.CFG).rows.map((r) => String(r["Clave"]).trim());
    const sh = ss.getSheetByName(TAB.CFG);
    SEED_CONFIG.filter((r) => existing.indexOf(r[0]) < 0).forEach((r) => sh.appendRow(r));
    forget_(TAB.CFG);
  }
  if (table_(TAB.MSG).rows.length === 0) {
    const sh = ss.getSheetByName(TAB.MSG);
    SEED_MENSAJES.forEach((r) => sh.appendRow(r));
    forget_(TAB.MSG);
  }
  if (table_(TAB.ACT).rows.length === 0) {
    const act = table_(TAB.ACT);
    const cap = Number(config_()["Capacidad por grupo"]) || 20;
    SEED_ACTIVIDADES.forEach((a) => {
      const base = { "Actividad": a[1], "Tipo": "FlashLab", "Inscripción": "Abierta", "Días": DIAS_DICIEMBRE, "Capacidad": cap, "Docentes": a[2] };
      append_(act, Object.assign({}, base, { "ID": a[0] + "-a", "Grupo": "A", "Habilitado": "SÍ", "Horario": a[3] }));
      if (a[4]) append_(act, Object.assign({}, base, { "ID": a[0] + "-b", "Grupo": "B", "Habilitado": "NO", "Horario": a[4] }));
    });
    forget_(TAB.ACT);
    applyCatalog_();
  }
  if (table_(TAB.EST).rows.length === 0) {
    const sh = ss.getSheetByName(TAB.EST);
    sh.getRange(1, STUDENT_BASE.length + 1).setValue("Programming_I");
    SEED_ESTUDIANTES_PRUEBA.forEach((r) => sh.appendRow(r));
  }
  Object.keys(TAB).forEach((k) => forget_(TAB[k]));

  formatTabs_();
  buildSummary_();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("API_SECRET")) props.setProperty("API_SECRET", Utilities.getUuid().replace(/-/g, ""));

  ScriptApp.getProjectTriggers()
    .filter((t) => ["onSheetEdit", "syncStudents"].indexOf(t.getHandlerFunction()) >= 0)
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("onSheetEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("syncStudents").timeBased().everyDays(1).atHour(3).create(); // todas las noches

  showSecret();
}

// ==========================================================
// Sincronización de estudiantes (inscripciones "back" + 360)
// ==========================================================
// El documento sale de "back" (es lo que identifica al estudiante). El TUMO ID de esa fila se
// busca en el 360 sólo para traer el estado y los cursos (para los requisitos).
// Copia únicamente las columnas que usa el sistema: nada de direcciones, fechas de nacimiento
// ni datos de los adultos. Las filas de "Estudiantes manuales" se suman (y ganan si se repite el documento).

const DATOS_360 = { OK: "OK", SIN_ID: "Sin TUMO ID en back", NO_360: "TUMO ID no está en el 360" };

// Lee la planilla de origen. Se usan valores mostrados (los TUMO ID de 16 dígitos pierden precisión como número).
function readSource_(cfg) {
  const sourceId = String(cfg["Origen estudiantes: planilla (ID o link)"] || "").replace(/.*\/d\/([^/]+).*/, "$1").trim();
  if (!sourceId) throw new Error("Falta el ID o link de la planilla de origen en Config.");
  const source = SpreadsheetApp.openById(sourceId);
  const backSheet = source.getSheetByName(String(cfg["Origen: pestaña inscripciones"] || "back").trim());
  const sheet360 = source.getSheetByName(String(cfg["Origen: pestaña 360"] || "360").trim());
  if (!backSheet || !sheet360) throw new Error("No encuentro las pestañas de origen (revisá los nombres en Config).");

  // 360: fila 1 = títulos
  const v360 = sheet360.getDataRange().getDisplayValues();
  const h360 = v360.shift().map((h) => String(h).trim());
  const idCol = h360.findIndex((h) => /^tumo\s*id$/i.test(h));
  const statusCol = h360.findIndex((h) => /^status$/i.test(h));
  if (idCol < 0) throw new Error("La pestaña 360 no tiene la columna TumoID.");
  const courses = h360.map((h, i) => ({ name: h, i: i })).filter((c) => /_(I|II|III|IV)$/.test(c.name));
  const by360 = {};
  v360.forEach((r) => { const id = String(r[idCol]).replace(/\D/g, ""); if (id) by360[id] = r; });

  // back: sin fila de títulos, columnas por letra (Config)
  const letter = (key, def) => columnIndex_(cfg[key] || def);
  const C = {
    doc: letter("Origen back: columna documento", "P"), tipo: letter("Origen back: columna tipo de documento", "O"),
    tumo: letter("Origen back: columna TUMO ID", "L"), ape: letter("Origen back: columna apellido", "M"),
    nom: letter("Origen back: columna nombre", "N"), mail: letter("Origen back: columna email", "F"),
    mail2: letter("Origen back: columna email 2", "G"),
  };
  const record = (r) => {
    const tumo = String(r[C.tumo] || "").replace(/\D/g, "");
    return {
      doc: dni_(r[C.doc]), tipo: r[C.tipo], tumo: tumo, nombre: r[C.nom], apellido: r[C.ape],
      mail: r[C.mail], mail2: r[C.mail2] === r[C.mail] ? "" : r[C.mail2], p360: tumo ? by360[tumo] || null : null,
    };
  };
  return {
    backRows: backSheet.getDataRange().getDisplayValues(), record: record, courses: courses, statusCol: statusCol,
    letters: { doc: cfg["Origen back: columna documento"] || "P", tumo: cfg["Origen back: columna TUMO ID"] || "L" },
    by360: by360,
  };
}

function syncStudents() {
  const started = Date.now();
  resetMemo_();
  const src = readSource_(config_());
  const courses = src.courses, statusCol = src.statusCol;

  const stats = { filas: 0, ignoradas: 0, duplicados: 0, sinTumo: 0, tumoSin360: 0, con360: 0, manuales: 0 };
  const students = {};
  src.backRows.forEach((r) => {
    stats.filas++;
    const rec = src.record(r);
    if (!isDoc_(rec.doc)) { stats.ignoradas++; return; } // fila de títulos, vacía o documento inválido
    const prev = students[rec.doc];
    if (prev) {
      stats.duplicados++;
      if (prev.p360 && !rec.p360) return; // se queda con la fila que tiene datos del 360 (o la más reciente)
    }
    students[rec.doc] = rec;
  });

  const headers = STUDENT_BASE.concat(courses.map((c) => c.name));
  const rows = {};
  Object.keys(students).forEach((doc) => {
    const s = students[doc];
    const datos = !s.tumo ? DATOS_360.SIN_ID : !s.p360 ? DATOS_360.NO_360 : DATOS_360.OK;
    if (!s.tumo) stats.sinTumo++; else if (!s.p360) stats.tumoSin360++; else stats.con360++;
    rows[doc] = [doc, s.tipo, s.tumo, s.nombre, s.apellido, s.mail, s.mail2, s.p360 && statusCol >= 0 ? s.p360[statusCol] : "", datos]
      .concat(courses.map((c) => (s.p360 ? s.p360[c.i] : "")));
  });

  // Estudiantes manuales: para casos que todavía no están en el origen (o para corregir alguno)
  const man = table_(TAB.MAN);
  man.rows.forEach((m) => {
    const doc = dni_(m["DNI"]);
    if (!isDoc_(doc)) return;
    stats.manuales++;
    rows[doc] = headers.map((h) => (h === "DNI" ? doc : (m[h] === undefined ? "" : String(m[h]))));
  });

  const sh = ss_().getSheetByName(TAB.EST);
  const values = [headers].concat(Object.keys(rows).map((doc) => rows[doc]));
  sh.clearContents();
  sh.getRange(1, 1, Math.max(values.length, 2), headers.length).setNumberFormat("@"); // todo como texto
  sh.getRange(1, 1, values.length, headers.length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#2730e7").setFontColor("#ffffff");
  forget_(TAB.EST);

  let user = "automático";
  try { user = Session.getActiveUser().getEmail() || user; } catch (err) { /* trigger */ }
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  append_(table_(TAB.SYNC), {
    "Fecha": new Date(), "Usuario": user, "Filas origen": stats.filas, "Estudiantes": values.length - 1,
    "Con cursos (360)": stats.con360, "Sin TUMO ID": stats.sinTumo, "TUMO ID sin 360": stats.tumoSin360,
    "Duplicados": stats.duplicados, "Filas ignoradas": stats.ignoradas, "Manuales": stats.manuales,
    "Segundos": seconds, "Detalle": courses.length + " columnas de cursos",
  });
  try { ss_().toast((values.length - 1) + " estudiantes cargados. Detalle en la pestaña Sync.", "FlashLabs", 8); } catch (err) { /* trigger */ }
  return stats;
}

function columnIndex_(letters) {
  return String(letters).trim().toUpperCase().split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

// ==========================================================
// Revisar un documento paso a paso (menú FlashLabs)
// ==========================================================
// 1) ¿está en back?  2) ¿su TUMO ID está en el 360?  3) valores de los cursos  4) resultado por FlashLab

function diagnoseStudent() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt("Revisar un documento", "DNI o documento del estudiante:", ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  ui.alert("Revisión de " + dni_(answer.getResponseText()), diagnose_(answer.getResponseText()), ui.ButtonSet.OK);
}

function diagnose_(input) {
  resetMemo_();
  const doc = dni_(input);
  if (!isDoc_(doc)) return "El documento tiene que tener entre 6 y 12 letras o números (con al menos un número).";
  const lines = [];

  // Pasos 1 y 2: directo en la planilla de origen (aunque todavía no se haya sincronizado)
  let fromSource = null;
  try {
    const src = readSource_(config_());
    const rows = src.backRows.map(src.record).filter((r) => r.doc === doc);
    if (!rows.length) {
      lines.push("1) back: ✗ No hay ninguna fila con este documento en la columna " + src.letters.doc + ".");
    } else {
      fromSource = rows.filter((r) => r.p360).pop() || rows[rows.length - 1];
      lines.push("1) back: ✓ " + fromSource.nombre + " " + fromSource.apellido + (rows.length > 1 ? " (" + rows.length + " filas)" : ""));
      if (!fromSource.tumo) {
        lines.push("2) 360: ✗ La fila de back no tiene TUMO ID (columna " + src.letters.tumo + ").");
      } else if (!fromSource.p360) {
        lines.push("2) 360: ✗ El TUMO ID " + fromSource.tumo + " de back no aparece en la columna TumoID del 360.");
      } else {
        lines.push("2) 360: ✓ TUMO ID " + fromSource.tumo + (src.statusCol >= 0 ? " · Status: " + fromSource.p360[src.statusCol] : ""));
      }
    }
  } catch (err) {
    lines.push("1-2) No pude leer la planilla de origen: " + err.message);
  }

  // Estado de la sincronización
  const found = findStudent_(doc);
  if (!found) {
    lines.push("Sincronizado: ✗ Todavía no está en Estudiantes → FlashLabs > Sincronizar estudiantes ahora.");
  } else {
    lines.push("Sincronizado: ✓ Datos 360: " + (found.student["Datos 360"] || "—"));
  }

  // Pasos 3 y 4: requisito de cada FlashLab (un grupo por actividad)
  if (found) {
    lines.push("");
    const seen = {};
    table_(TAB.ACT).rows.filter((a) => a["ID"]).forEach((a) => {
      if (seen[a["Actividad"]]) return;
      seen[a["Actividad"]] = true;
      const req = requirement_(a, found.student, found.headers);
      const icon = { ok: "✅", no: "⛔", unknown: "⚠️" }[req];
      lines.push(icon + " " + a["Actividad"] + " — " + requirementDetail_(a, found.student, found.headers));
    });
    const active = table_(TAB.SOL).rows.filter((s) => dni_(s["DNI"]) === doc && ACTIVOS.indexOf(s["Estado"]) >= 0);
    lines.push("");
    lines.push(active.length
      ? "Solicitud activa: " + active.map((s) => s["Actividad"] + " " + s["Grupo"] + " (" + s["Estado"] + ")").join(", ")
      : "Solicitud activa: ninguna");
  }
  return lines.join("\n");
}

// ==========================================================
// Descripciones y requisitos (CATALOGO) → pestaña Actividades
// ==========================================================

function applyCatalog() {
  resetMemo_();
  const n = applyCatalog_();
  try { ss_().toast(n + " filas de Actividades actualizadas.", "FlashLabs", 6); } catch (err) { /* sin UI */ }
}

function applyCatalog_() {
  const act = table_(TAB.ACT);
  let updated = 0;
  act.rows.forEach((row) => {
    const base = String(row["ID"]).replace(/-[a-z]$/i, ""); // musica-cine-a → musica-cine
    const c = CATALOGO[base];
    if (!c) return;
    const changes = {
      "Actividad": c.nombre, "Descripción": c.descripcion, "Requisito": c.requisito,
      "Columna requisito": c.regla, "Valor requerido": c.valor, "Capacidad": c.capacidad, "Herramientas": c.herramientas,
    };
    Object.keys(changes).forEach((k) => { if (changes[k] === null || changes[k] === undefined) delete changes[k]; });
    setCells_(act, row, changes);
    updated++;
  });
  forget_(TAB.ACT);
  return updated;
}

function ensureTab_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // Agrega columnas que falten sin tocar las existentes
    const current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    headers.filter((h) => current.indexOf(h) < 0).forEach((h) => {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
    });
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight("bold").setBackground("#2730e7").setFontColor("#ffffff");
  return sh;
}

function formatTabs_() {
  const sol = table_(TAB.SOL);
  const estadoCol = sol.headers.indexOf("Estado") + 1;
  sol.sh.getRange(2, estadoCol, sol.sh.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build());
  ["DNI"].forEach((h) => {
    [TAB.SOL, TAB.EST].forEach((tab) => {
      const t = table_(tab);
      const c = t.headers.indexOf(h) + 1;
      if (c > 0) t.sh.getRange(2, c, t.sh.getMaxRows() - 1, 1).setNumberFormat("@");
    });
  });
  const act = table_(TAB.ACT);
  const yesNo = SpreadsheetApp.newDataValidation().requireValueInList(["SÍ", "NO"], true).build();
  act.sh.getRange(2, act.headers.indexOf("Habilitado") + 1, act.sh.getMaxRows() - 1, 1).setDataValidation(yesNo);
  act.sh.getRange(2, act.headers.indexOf("Inscripción") + 1, act.sh.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["Abierta", "Lista de espera", "Cerrada"], true).build());
}

// Pestaña de sólo lectura con vacantes por actividad y grupo (fórmulas, se actualiza sola)
function buildSummary_() {
  const ss = ss_();
  let sh = ss.getSheetByName(TAB.RES);
  if (!sh) sh = ss.insertSheet(TAB.RES, 0);
  sh.clear();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach((p) => p.remove());
  const act = table_(TAB.ACT);
  const sol = table_(TAB.SOL);
  const L = (t, h) => columnLetter_(t.headers.indexOf(h) + 1);
  const solId = "Solicitudes!" + L(sol, "Actividad ID") + ":" + L(sol, "Actividad ID");
  const solEstado = "Solicitudes!" + L(sol, "Estado") + ":" + L(sol, "Estado");
  const countIf = (cell, estado) => "COUNTIFS(" + solId + "," + cell + "," + solEstado + ",\"" + estado + "\")";

  sh.getRange(1, 1, 1, 10).setValues([["ID", "Actividad", "Grupo", "Habilitado", "Capacidad",
    "En validación", "Pendientes", "Confirmadas", "Lista de espera", "Libres"]]);
  const rows = Math.max(act.rows.length, 1) + 20; // margen para actividades nuevas
  const formulas = [];
  for (let i = 0; i < rows; i++) {
    const r = i + 2;
    const id = "A" + r;
    const ref = (h) => "Actividades!" + L(act, h) + r;
    formulas.push([
      "=IF(" + ref("ID") + "=\"\",\"\"," + ref("ID") + ")",
      "=IF(" + id + "=\"\",\"\"," + ref("Actividad") + ")",
      "=IF(" + id + "=\"\",\"\"," + ref("Grupo") + ")",
      "=IF(" + id + "=\"\",\"\"," + ref("Habilitado") + ")",
      "=IF(" + id + "=\"\",\"\"," + ref("Capacidad") + ")",
      "=IF(" + id + "=\"\",\"\"," + countIf(id, ESTADO.VALIDACION) + ")",
      "=IF(" + id + "=\"\",\"\"," + countIf(id, ESTADO.PENDIENTE) + ")",
      "=IF(" + id + "=\"\",\"\"," + countIf(id, ESTADO.CONFIRMADA) + ")",
      "=IF(" + id + "=\"\",\"\"," + countIf(id, ESTADO.ESPERA) + ")",
      "=IF(" + id + "=\"\",\"\",E" + r + "-H" + r + ")",
    ]);
  }
  sh.getRange(2, 1, rows, 10).setFormulas(formulas);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#f6ab1e");
  sh.protect().setWarningOnly(true).setDescription("Se calcula solo. Editá Actividades o Solicitudes.");
}

function columnLetter_(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function showSecret() {
  const secret = PropertiesService.getScriptProperties().getProperty("API_SECRET");
  const text = "Clave de la API (pegala en Vercel como APPS_SCRIPT_KEY):\n\n" + secret;
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { console.log(text); }
}
