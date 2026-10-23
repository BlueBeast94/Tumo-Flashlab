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
};

// El código busca las columnas por nombre: se pueden reordenar o agregar columnas nuevas.
const HEADERS = {
  Actividades: ["ID", "Actividad", "Tipo", "Grupo", "Habilitado", "Inscripción", "Días", "Horario",
    "Capacidad", "Requisito", "Columna requisito", "Descripción", "Imagen", "Docentes"],
  Estudiantes: ["DNI", "TUMO ID", "Nombre", "Apellido", "Email", "Teléfono", "Cursos completados", "Nivel"],
  Solicitudes: ["ID", "Fecha", "DNI", "TUMO ID", "Nombre ingresado", "Nombre 360", "Email", "Actividad ID",
    "Actividad", "Grupo", "Estado", "Validación", "Motivo", "Vence invitación", "Token", "Actualizado", "Notas"],
  Historial: ["Fecha", "Usuario", "Solicitud", "DNI", "Antes", "Después", "Detalle"],
  Mensajes: ["Clave", "Asunto", "Cuerpo"],
  Config: ["Clave", "Valor", "Descripción"],
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
];

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

const SEED_ESTUDIANTES_PRUEBA = [
  // DNI, TUMO ID, Nombre, Apellido, Email, Teléfono, Cursos completados, Nivel, Programación completada
  ["40000001", "T-0001", "Martina", "Gómez", "martina@example.com", "1100000001", "Animación 1", 1, "SÍ"],
  ["40000002", "T-0002", "Tomás", "Rodríguez", "tomas@example.com", "1100000002", "Programación 1, Programación 2", 2, "SÍ"],
  ["40000003", "T-0003", "Lucía", "Pérez", "lucia@example.com", "1100000003", "", 1, "NO"],
  ["40000004", "T-0004", "Benjamín", "Sosa", "benja@example.com", "1100000004", "Música 1", 1, ""],
  ["40000005", "T-0005", "Sofía", "López", "", "1100000005", "Robótica 1", 2, "SÍ"],
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
const dni_ = (v) => String(v === undefined || v === null ? "" : v).replace(/\D/g, "");
const YES = ["si", "yes", "true", "x", "1", "ok", "completado", "completada", "completo", "aprobado"];
const NO = ["no", "false", "0", "pendiente", "incompleto"];
const isYes_ = (v) => v === true || YES.indexOf(norm_(v)) >= 0;
const isNo_ = (v) => v === false || NO.indexOf(norm_(v)) >= 0;

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
  const ocupadas = count(OCUPAN);
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
  if (!/^\d{7,8}$/.test(dni)) return { status: "dni_invalido" };

  const est = table_(TAB.EST);
  const student = est.rows.find((r) => dni_(r["DNI"]) === dni);
  if (!student) return { status: "no_encontrado" };

  const solicitudes = table_(TAB.SOL).rows;
  if (solicitudes.some((s) => dni_(s["DNI"]) === dni && ACTIVOS.indexOf(s["Estado"]) >= 0)) {
    return { status: "activa" };
  }

  if (!actividadId) return { status: "ok", student: student };
  const act = table_(TAB.ACT).rows.find((a) => a["ID"] === actividadId && isYes_(a["Habilitado"]));
  if (!act) return { status: "actividad_invalida" };
  const disp = availability_(act, solicitudes, config_());
  if (disp.estado === "cerrada") return { status: "cerrada" };

  const result = { student: student, act: act, lugar: disp.estado === "espera" ? "espera" : "vacante" };
  const column = String(act["Columna requisito"] || "").trim();
  if (!column) return Object.assign(result, { status: "ok" });
  if (est.headers.indexOf(column) < 0) return Object.assign(result, { status: "sin_verificar", motivo: act["Requisito"] });

  const value = student[column];
  if (isYes_(value)) return Object.assign(result, { status: "ok" });
  if (isNo_(value)) return Object.assign(result, { status: "no_cumple", motivo: act["Requisito"] });
  return Object.assign(result, { status: "sin_verificar", motivo: act["Requisito"] });
}

function publicVerify_(r) {
  const out = { status: r.status };
  if (r.lugar && (r.status === "ok" || r.status === "sin_verificar")) out.lugar = r.lugar;
  if (r.motivo) out.motivo = String(r.motivo);
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
    if (r.status !== "ok" && r.status !== "sin_verificar") return publicVerify_(r);

    const estado = r.status === "sin_verificar" ? ESTADO.VALIDACION
      : r.lugar === "espera" ? ESTADO.ESPERA : ESTADO.PENDIENTE;
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
      "Email": r.student["Email"],
      "Actividad ID": r.act["ID"],
      "Actividad": r.act["Actividad"],
      "Grupo": r.act["Grupo"],
      "Estado": estado,
      "Validación": r.status === "ok" ? "Identidad OK · Requisitos OK" : "Identidad OK · Requisito sin verificar",
      "Motivo": r.status === "sin_verificar" ? "Verificar a mano: " + (r.motivo || "requisito") : "",
      "Token": Utilities.getUuid(),
      "Actualizado": new Date(),
    };
    append_(sol, row);
    log_(row, "", estado, "Solicitud recibida desde la web");
    sendTemplate_("RECEPCION", row, r.act);
    return { status: "ok", estado: estado, mensaje: ESTADO_PUBLICO[estado] };
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
  }
  if (table_(TAB.MSG).rows.length === 0) {
    const sh = ss.getSheetByName(TAB.MSG);
    SEED_MENSAJES.forEach((r) => sh.appendRow(r));
    forget_(TAB.MSG);
  }
  if (table_(TAB.ACT).rows.length === 0) {
    const sh = ss.getSheetByName(TAB.ACT);
    const cap = Number(config_()["Capacidad por grupo"]) || 20;
    SEED_ACTIVIDADES.forEach((a) => {
      sh.appendRow([a[0] + "-a", a[1], "FlashLab", "A", "SÍ", "Abierta", DIAS_DICIEMBRE, a[3], cap, "", "", "", "", a[2]]);
      if (a[4]) sh.appendRow([a[0] + "-b", a[1], "FlashLab", "B", "NO", "Abierta", DIAS_DICIEMBRE, a[4], cap, "", "", "", "", a[2]]);
    });
  }
  if (table_(TAB.EST).rows.length === 0) {
    const sh = ss.getSheetByName(TAB.EST);
    sh.getRange(1, HEADERS.Estudiantes.length + 1).setValue("Programación completada");
    SEED_ESTUDIANTES_PRUEBA.forEach((r) => sh.appendRow(r));
  }
  Object.keys(TAB).forEach((k) => forget_(TAB[k]));

  formatTabs_();
  buildSummary_();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("API_SECRET")) props.setProperty("API_SECRET", Utilities.getUuid().replace(/-/g, ""));

  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "onSheetEdit")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("onSheetEdit").forSpreadsheet(ss).onEdit().create();

  showSecret();
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
