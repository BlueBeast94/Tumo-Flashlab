// ==========================================================
// TUMO Flash Lab — backend en Google Apps Script
// Pegar en: Planilla de respuestas > Extensiones > Apps Script
// Ver SETUP.md para los pasos de instalación.
// ==========================================================

const EVENT = {
  NAME: "TUMO Flash Lab",
  CAPACITY: 20,
  CONFIRM_HOURS: 48,          // tiempo para confirmar antes de perder el lugar
  REMINDER_HOURS: 24,         // recordatorio si todavía no confirmó
  DATE: "sábado 13 de diciembre",
  TIME: "10:00 a 17:00",
  PLACE: "TUMO Buenos Aires — dirección a confirmar",
  START: new Date("2026-12-13T10:00:00-03:00"),
};

const SHEET_NAME = "Respuestas de formulario 1";

// Columnas del formulario (deben coincidir con los títulos de las preguntas)
const FORM = {
  FIRST: "Nombre del participante",
  LAST: "Apellido del participante",
  DNI: "DNI del participante",
  EMAIL: "Email de contacto",
  ACTIVITY: "Actividad",
};

// Columnas que agrega el script a la derecha de las del formulario
const EXTRA = ["Estado", "Token", "Confirmado el", "Mails enviados"];

const STATUS = {
  REGISTERED: "registered",   // se inscribió, falta confirmar
  CONFIRMED: "confirmed",     // confirmó y está dentro del cupo
  WAITLIST: "waitlist",       // confirmó pero el cupo estaba lleno
  EXPIRED: "expired",         // no confirmó a tiempo
  DUPLICATE: "duplicate",     // el participante ya tenía otra inscripción activa
  CANCELLED: "cancelled",     // se dio de baja (se marca a mano)
};
const ACTIVE = [STATUS.REGISTERED, STATUS.CONFIRMED, STATUS.WAITLIST];

// ---------- Acceso a la planilla ----------

function sheet_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  EXTRA.forEach((h) => {
    if (!headers.includes(h)) {
      headers.push(h);
      sh.getRange(1, headers.length).setValue(h);
    }
  });
  return sh;
}

function rows_() {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  return values.map((v, i) => {
    const row = { _row: i + 2 };
    headers.forEach((h, j) => { row[h] = v[j]; });
    return row;
  });
}

function update_(row, changes) {
  const sh = sheet_();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  Object.keys(changes).forEach((key) => {
    sh.getRange(row._row, headers.indexOf(key) + 1).setValue(changes[key]);
    row[key] = changes[key];
  });
}

const normDni_ = (v) => String(v).replace(/\D/g, "");
const normEmail_ = (v) => String(v).trim().toLowerCase();

function logMail_(row, kind) {
  const sent = row["Mails enviados"] ? row["Mails enviados"] + ", " : "";
  update_(row, { "Mails enviados": sent + kind });
}
const wasSent_ = (row, kind) => String(row["Mails enviados"] || "").split(", ").includes(kind);

// ---------- 1. Nueva inscripción (trigger: al enviar formulario) ----------

function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const all = rows_();
    const row = all.find((r) => r._row === e.range.getRow());
    const dni = normDni_(row[FORM.DNI]);

    // Un participante = un DNI. Así un padre puede anotar a varios hijos con el mismo mail,
    // pero nadie puede ocupar dos lugares ni pasarse a otra actividad.
    const existing = all.find((r) => r._row !== row._row && normDni_(r[FORM.DNI]) === dni && ACTIVE.includes(r["Estado"]));
    if (existing) {
      update_(row, { "Estado": STATUS.DUPLICATE });
      sendMail_(row, "duplicate", { activity: existing[FORM.ACTIVITY], status: existing["Estado"] });
      return;
    }

    update_(row, { "Estado": STATUS.REGISTERED, "Token": Utilities.getUuid() });
    sendMail_(row, "registered");
  } finally {
    lock.releaseLock();
  }
}

// ---------- 2 y 3. Web App: confirmación, lista y estado ----------

function doGet(e) {
  const action = e.parameter.action;
  if (action === "confirm") return confirm_(e.parameter.token);
  if (action === "board") return json_({ confirmed: boardNames_() });
  if (action === "status") return json_({ status: statusFor_(e.parameter.email) });
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

    const taken = all.filter((r) => r["Estado"] === STATUS.CONFIRMED).length;
    const status = taken < EVENT.CAPACITY ? STATUS.CONFIRMED : STATUS.WAITLIST;
    update_(row, { "Estado": status, "Confirmado el": new Date() });
    sendMail_(row, status);

    return status === STATUS.CONFIRMED
      ? page_("¡Lugar asegurado!", "Estás dentro de los " + EVENT.CAPACITY + " confirmados. Te mandamos los detalles por mail.")
      : page_("Estás en lista de espera", "El cupo ya se completó. Si se libera un lugar te avisamos por mail.");
  } finally {
    lock.releaseLock();
  }
}

// Sólo nombre + inicial del apellido, ordenados por fecha de confirmación
function boardNames_() {
  return rows_()
    .filter((r) => r["Estado"] === STATUS.CONFIRMED)
    .sort((a, b) => new Date(a["Confirmado el"]) - new Date(b["Confirmado el"]))
    .slice(0, EVENT.CAPACITY)
    .map((r) => String(r[FORM.FIRST]).trim() + " " + String(r[FORM.LAST]).trim().charAt(0).toUpperCase() + ".");
}

// Si un mail tiene varios participantes, devuelve el estado "mejor"
function statusFor_(email) {
  const order = [STATUS.CONFIRMED, STATUS.WAITLIST, STATUS.REGISTERED, STATUS.EXPIRED];
  const mine = rows_().filter((r) => normEmail_(r[FORM.EMAIL]) === normEmail_(email)).map((r) => r["Estado"]);
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
      const hours = (now - new Date(r["Marca temporal"])) / 36e5;
      if (hours >= EVENT.CONFIRM_HOURS) {
        update_(r, { "Estado": STATUS.EXPIRED });
        sendMail_(r, "expired");
      } else if (hours >= EVENT.REMINDER_HOURS && !wasSent_(r, "reminder")) {
        sendMail_(r, "reminder");
      }
    });

    // Si alguien se dio de baja, el primero de la lista de espera sube
    let free = EVENT.CAPACITY - all.filter((r) => r["Estado"] === STATUS.CONFIRMED).length;
    all.filter((r) => r["Estado"] === STATUS.WAITLIST)
      .sort((a, b) => new Date(a["Confirmado el"]) - new Date(b["Confirmado el"]))
      .forEach((r) => {
        if (free-- > 0) {
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

// ---------- Mails ----------

function sendMail_(row, kind, extra) {
  const name = String(row[FORM.FIRST]).trim();
  const activity = row[FORM.ACTIVITY];
  const confirmUrl = ScriptApp.getService().getUrl() + "?action=confirm&token=" + row["Token"];
  const when = EVENT.DATE + ", " + EVENT.TIME;

  const templates = {
    registered: ["Recibimos tu inscripción", [
      "¡Hola! Recibimos la inscripción de " + name + " a <b>" + activity + "</b>.",
      "Para reservar el lugar, confirmá dentro de las próximas " + EVENT.CONFIRM_HOURS + " horas:",
      button_("Confirmar asistencia", confirmUrl),
    ]],
    reminder: ["Recordá confirmar tu lugar", [
      "Todavía no confirmaste la asistencia de " + name + ". Si no confirmás, el lugar se libera.",
      button_("Confirmar ahora", confirmUrl),
    ]],
    confirmed: ["¡Lugar asegurado!", [
      name + " está dentro de los " + EVENT.CAPACITY + " confirmados para <b>" + activity + "</b>.",
      "<b>Cuándo:</b> " + when + "<br><b>Dónde:</b> " + EVENT.PLACE,
    ]],
    waitlist: ["Estás en lista de espera", [
      "Gracias por confirmar. El cupo ya se completó, así que " + name + " quedó en lista de espera.",
      "Si se libera un lugar te avisamos por este medio.",
    ]],
    promoted: ["¡Se liberó un lugar para vos!", [
      "Se liberó un lugar y " + name + " ya está confirmado/a para <b>" + activity + "</b>.",
      "<b>Cuándo:</b> " + when + "<br><b>Dónde:</b> " + EVENT.PLACE,
    ]],
    expired: ["Se liberó tu lugar", [
      "No recibimos la confirmación de " + name + " a tiempo, así que el lugar pasó a la siguiente persona.",
      "¡Te esperamos en el próximo Flash Lab!",
    ]],
    duplicate: ["Ya tenés una inscripción activa", [
      name + " ya está inscripto/a en <b>" + (extra && extra.activity) + "</b> (" + label_(extra && extra.status) + ").",
      "Cada participante puede tener un solo lugar, así que no registramos esta nueva inscripción.",
    ]],
    event_soon: ["Faltan 2 días para el Flash Lab", [
      "¡Ya casi! Te esperamos el " + when + ".",
      "<b>Dónde:</b> " + EVENT.PLACE,
      "Si sos menor, traé la autorización firmada por tu adulto responsable.",
    ]],
    event_today: ["¡Hoy es el Flash Lab!", [
      "Te esperamos hoy de " + EVENT.TIME + " en " + EVENT.PLACE + ".",
    ]],
  };

  const [subject, lines] = templates[kind];
  MailApp.sendEmail({
    to: row[FORM.EMAIL],
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

// Ejecutar UNA vez a mano para crear los triggers
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onFormSubmit").forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger("hourlyJob").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("dailyJob").timeBased().everyDays(1).atHour(9).create();
}
