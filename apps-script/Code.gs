// ==========================================================
// TUMO Flash Lab — backend en Google Apps Script
// Pegar en: Planilla > Extensiones > Apps Script
// Ver SETUP.md para los pasos de instalación.
// ==========================================================

const EVENT = {
  NAME: "TUMO Flash Lab",
  CAPACITY: 20,               // lugares por lab y por turno
  CONFIRM_HOURS: 48,          // tiempo para confirmar antes de perder el lugar
  REMINDER_HOURS: 24,         // recordatorio si todavía no confirmó
  DATE: "sábado 13 de diciembre",
  PLACE: "TUMO Buenos Aires — dirección a confirmar",
  START: new Date("2026-12-13T10:00:00-03:00"),
};

// Deben coincidir con LABS y TURNOS de config.js
const LABS = {
  programacion: "Programación",
  videojuegos: "Game Development",
  animacion: "Animación",
  robotica: "Robótica",
};
const TURNOS = {
  TM: "Turno mañana (10:00 a 13:00)",
  TT: "Turno tarde (14:00 a 17:00)",
};

const SHEET_NAME = "Inscripciones";
const HEADERS = [
  "Fecha", "Lab", "Turno", "Documento", "Nombre", "Apellido", "Email estudiante",
  "Nombre responsable", "Apellido responsable", "Email responsable",
  "Estado", "Token", "Confirmado el", "Mails enviados",
];

const STATUS = {
  REGISTERED: "registered",   // se inscribió, falta confirmar
  CONFIRMED: "confirmed",     // confirmó y está dentro del cupo
  WAITLIST: "waitlist",       // confirmó pero el cupo estaba lleno
  EXPIRED: "expired",         // no confirmó a tiempo
  CANCELLED: "cancelled",     // se dio de baja (se marca a mano)
};
const ACTIVE = [STATUS.REGISTERED, STATUS.CONFIRMED, STATUS.WAITLIST];

// ---------- Acceso a la planilla ----------

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange("D:D").setNumberFormat("@"); // el DNI como texto
  }
  return sh;
}

function rows_() {
  const values = sheet_().getDataRange().getValues();
  values.shift();
  return values.map((v, i) => {
    const row = { _row: i + 2 };
    HEADERS.forEach((h, j) => { row[h] = v[j]; });
    return row;
  });
}

function update_(row, changes) {
  const sh = sheet_();
  Object.keys(changes).forEach((key) => {
    sh.getRange(row._row, HEADERS.indexOf(key) + 1).setValue(changes[key]);
    row[key] = changes[key];
  });
}

const normDni_ = (v) => String(v).replace(/\D/g, "");
const clean_ = (v) => String(v || "").trim();
const sameSlot_ = (a, b) => a["Lab"] === b["Lab"] && a["Turno"] === b["Turno"];

function logMail_(row, kind) {
  const sent = row["Mails enviados"] ? row["Mails enviados"] + ", " : "";
  update_(row, { "Mails enviados": sent + kind });
}
const wasSent_ = (row, kind) => String(row["Mails enviados"] || "").split(", ").includes(kind);

// ---------- 1. Nueva inscripción (POST desde inscripcion.html) ----------

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.action !== "register") return json_({ status: "error" });

  const dni = normDni_(data.documento);
  const valid = LABS[data.lab] && TURNOS[data.turno] && /^\d{7,8}$/.test(dni) &&
    clean_(data.nombre) && clean_(data.apellido) && clean_(data.email) &&
    clean_(data.respNombre) && clean_(data.respApellido) && clean_(data.respEmail);
  if (!valid) return json_({ status: "error" });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Un participante = un documento. Un padre puede anotar a varios hijos con su mail,
    // pero nadie puede ocupar dos lugares ni anotarse en otro lab.
    const existing = rows_().find((r) => normDni_(r["Documento"]) === dni && ACTIVE.includes(r["Estado"]));
    if (existing) return json_({ status: "duplicate" });

    sheet_().appendRow([
      new Date(), data.lab, data.turno, dni,
      clean_(data.nombre), clean_(data.apellido), clean_(data.email).toLowerCase(),
      clean_(data.respNombre), clean_(data.respApellido), clean_(data.respEmail).toLowerCase(),
      STATUS.REGISTERED, Utilities.getUuid(), "", "",
    ]);
    const row = rows_().pop();
    sendMail_(row, "registered");
    return json_({ status: "ok" });
  } finally {
    lock.releaseLock();
  }
}

// ---------- 2 y 3. Confirmación y consulta de estado (GET) ----------

function doGet(e) {
  const action = e.parameter.action;
  if (action === "confirm") return confirm_(e.parameter.token);
  if (action === "status") return json_({ status: statusFor_(e.parameter.dni) });
  return json_({ error: "unknown action" });
}

function confirm_(token) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const all = rows_();
    const row = all.find((r) => r["Token"] === token);
    if (!row) return page_("Link inválido", "No encontramos esta inscripción.");
    if (row["Estado"] === STATUS.EXPIRED) return page_("Se venció el plazo", "No confirmaste a tiempo y el lugar se liberó.");
    if (row["Estado"] !== STATUS.REGISTERED) return page_("Ya confirmaste", "Tu estado actual: " + label_(row["Estado"]));

    const taken = all.filter((r) => r["Estado"] === STATUS.CONFIRMED && sameSlot_(r, row)).length;
    const status = taken < EVENT.CAPACITY ? STATUS.CONFIRMED : STATUS.WAITLIST;
    update_(row, { "Estado": status, "Confirmado el": new Date() });
    sendMail_(row, status);

    return status === STATUS.CONFIRMED
      ? page_("¡Lugar asegurado!", "Estás dentro de los " + EVENT.CAPACITY + " confirmados. Te mandamos los detalles por mail.")
      : page_("Estás en lista de espera", "El cupo de este turno ya se completó. Si se libera un lugar te avisamos por mail.");
  } finally {
    lock.releaseLock();
  }
}

// Sólo devuelve una palabra de estado, nunca datos personales
function statusFor_(dni) {
  const mine = rows_().filter((r) => normDni_(r["Documento"]) === normDni_(dni)).map((r) => r["Estado"]);
  const order = [STATUS.CONFIRMED, STATUS.WAITLIST, STATUS.REGISTERED, STATUS.EXPIRED];
  return order.find((s) => mine.includes(s)) || "not_found";
}

// ---------- 4. Tarea horaria: recordatorios, vencimientos, lista de espera ----------

function hourlyJob() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();
    const all = rows_();

    all.filter((r) => r["Estado"] === STATUS.REGISTERED).forEach((r) => {
      const hours = (now - new Date(r["Fecha"])) / 36e5;
      if (hours >= EVENT.CONFIRM_HOURS) {
        update_(r, { "Estado": STATUS.EXPIRED });
        sendMail_(r, "expired");
      } else if (hours >= EVENT.REMINDER_HOURS && !wasSent_(r, "reminder")) {
        sendMail_(r, "reminder");
      }
    });

    // Si alguien se dio de baja, el primero de la lista de espera de ese lab/turno sube
    const waiting = all.filter((r) => r["Estado"] === STATUS.WAITLIST)
      .sort((a, b) => new Date(a["Confirmado el"]) - new Date(b["Confirmado el"]));
    waiting.forEach((r) => {
      const taken = all.filter((x) => x["Estado"] === STATUS.CONFIRMED && sameSlot_(x, r)).length;
      if (taken < EVENT.CAPACITY) {
        update_(r, { "Estado": STATUS.CONFIRMED });
        sendMail_(r, "promoted");
      }
    });
  } finally {
    lock.releaseLock();
  }
}

// ---------- 5. Tarea diaria: recordatorio del evento ----------

function dailyJob() {
  const daysLeft = Math.ceil((EVENT.START - new Date()) / 864e5);
  if (daysLeft !== 2 && daysLeft !== 0) return;
  const kind = daysLeft === 2 ? "event_soon" : "event_today";
  rows_()
    .filter((r) => r["Estado"] === STATUS.CONFIRMED && !wasSent_(r, kind))
    .forEach((r) => sendMail_(r, kind));
}

// ---------- Mails (van al estudiante y al responsable) ----------

function sendMail_(row, kind) {
  const name = row["Nombre"];
  const lab = "<b>" + LABS[row["Lab"]] + "</b> · " + TURNOS[row["Turno"]];
  const confirmUrl = ScriptApp.getService().getUrl() + "?action=confirm&token=" + row["Token"];
  const when = "<b>Cuándo:</b> " + EVENT.DATE + ", " + TURNOS[row["Turno"]] + "<br><b>Dónde:</b> " + EVENT.PLACE;

  const templates = {
    registered: ["Recibimos tu inscripción", [
      "¡Hola! Recibimos la inscripción de " + name + " a " + lab + ".",
      "Para reservar el lugar, confirmá dentro de las próximas " + EVENT.CONFIRM_HOURS + " horas:",
      button_("Confirmar asistencia", confirmUrl),
    ]],
    reminder: ["Recordá confirmar tu lugar", [
      "Todavía no confirmaste la asistencia de " + name + " a " + lab + ". Si no confirmás, el lugar se libera.",
      button_("Confirmar ahora", confirmUrl),
    ]],
    confirmed: ["¡Lugar asegurado!", [
      name + " está dentro de los " + EVENT.CAPACITY + " confirmados para " + lab + ".",
      when,
    ]],
    waitlist: ["Estás en lista de espera", [
      "Gracias por confirmar. El cupo de " + lab + " ya se completó, así que " + name + " quedó en lista de espera.",
      "Si se libera un lugar te avisamos por este medio.",
    ]],
    promoted: ["¡Se liberó un lugar para vos!", [
      "Se liberó un lugar y " + name + " ya está confirmado/a para " + lab + ".",
      when,
    ]],
    expired: ["Se liberó tu lugar", [
      "No recibimos la confirmación de " + name + " a tiempo, así que el lugar pasó a la siguiente persona.",
      "¡Te esperamos en el próximo Flash Lab!",
    ]],
    event_soon: ["Faltan 2 días para el Flash Lab", [
      "¡Ya casi! Te esperamos en " + lab + ".",
      when,
      "Si sos menor, traé la autorización firmada por tu adulto responsable.",
    ]],
    event_today: ["¡Hoy es el Flash Lab!", [
      "Te esperamos hoy.",
      when,
    ]],
  };

  const [subject, lines] = templates[kind];
  MailApp.sendEmail({
    to: [row["Email estudiante"], row["Email responsable"]].filter(String).join(","),
    subject: EVENT.NAME + " · " + subject,
    htmlBody: layout_(subject, lines),
    name: "TUMO Buenos Aires",
  });
  logMail_(row, kind);
}

function layout_(title, lines) {
  return '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">' +
    '<div style="background:#2730e7;color:#fff;padding:24px;border-radius:20px 20px 0 0">' +
    '<div style="font-weight:900;font-size:22px">TUMO <span style="font-size:11px">BUENOS AIRES</span></div>' +
    '<h1 style="margin:16px 0 0;font-size:26px">' + title + "</h1></div>" +
    '<div style="background:#f2f2f2;padding:24px;border-radius:0 0 20px 20px;font-size:16px;line-height:1.5">' +
    lines.map((l) => "<p>" + l + "</p>").join("") + "</div></div>";
}

function button_(text, url) {
  return '<a href="' + url + '" style="display:inline-block;background:#e75227;color:#fff;padding:14px 28px;' +
    'border-radius:999px;text-decoration:none;font-weight:bold">' + text + "</a>";
}

// ---------- Utilidades ----------

function label_(status) {
  return {
    registered: "pendiente de confirmación",
    confirmed: "confirmado",
    waitlist: "en lista de espera",
    expired: "vencido",
  }[status] || status;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function page_(title, text) {
  return HtmlService.createHtmlOutput(layout_(title, [text]))
    .setTitle(EVENT.NAME)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// Ejecutar UNA vez a mano: crea la hoja y los triggers
function setup() {
  sheet_();
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("hourlyJob").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("dailyJob").timeBased().everyDays(1).atHour(9).create();
}
