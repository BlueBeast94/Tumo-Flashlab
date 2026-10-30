// ==========================================================
// TUMO Barracas FlashLabs — puente entre la web y la planilla (Vercel Serverless Function)
//
// GET  /api/inscripcion?action=actividades
// GET  /api/inscripcion?action=verificar&dni=…&actividad=…
// GET  /api/inscripcion?action=estado&dni=…
// GET  /api/inscripcion?action=invitacion&token=…   (página confirmar.html, botón del mail)
// POST /api/inscripcion  { action: "solicitud", dni, nombre, actividad, confirmado: true }
// POST /api/inscripcion  { action: "confirmar", token }
//
// Variables de entorno en Vercel: APPS_SCRIPT_URL (URL /exec del Web App) y APPS_SCRIPT_KEY.
// La URL y la clave del Apps Script nunca llegan al navegador.
// ==========================================================

const { callAppsScript, isConfigured } = require("./_appsScript");
const { handleCors } = require("./_cors");

// Límite por IP y por minuto (en memoria: es aproximado, alcanza para frenar abusos simples)
const LIMITS = { actividades: 60, verificar: 30, estado: 20, invitacion: 20, solicitud: 6, confirmar: 10 };
const hits = new Map();

function rateLimited(ip, action) {
    const key = `${ip}:${action}`;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < 60000);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > (LIMITS[action] || 20);
}

function readBody(req) {
    if (req.body) return Promise.resolve(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", () => {
            try { resolve(JSON.parse(raw || "{}")); } catch (err) { reject(err); }
        });
    });
}

function send(res, status, data, headers = {}) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.end(JSON.stringify(data));
}

const clean = (v, max = 80) => String(v || "").slice(0, max);
// Documento: DNI, pasaporte u otro → sólo letras y números en mayúsculas
const docId = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
// Token de la solicitud (UUID) que va en el link del mail
const tokenId = (v) => String(v || "").toLowerCase().replace(/[^0-9a-f-]/g, "").slice(0, 36);

module.exports = async function handler(req, res) {
    if (handleCors(req, res)) return;
    if (!isConfigured()) {
        return send(res, 503, { status: "no_configurado" });
    }
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET") {
        const action = url.searchParams.get("action");
        if (!["actividades", "verificar", "estado", "invitacion"].includes(action)) return send(res, 400, { status: "accion_invalida" });
        if (rateLimited(ip, action)) return send(res, 429, { status: "demasiados_intentos" });

        const params = { action };
        if (action === "invitacion") params.token = tokenId(url.searchParams.get("token"));
        else if (action !== "actividades") params.dni = docId(url.searchParams.get("dni"));
        if (action === "verificar") params.actividad = clean(url.searchParams.get("actividad"), 40);
        const data = await callAppsScript(params);
        const cache = action === "actividades" && data.status === "ok"
            ? { "Cache-Control": "s-maxage=20, stale-while-revalidate=60" }
            : { "Cache-Control": "no-store" };
        return send(res, data.status === "timeout" ? 504 : 200, data, cache);
    }

    if (req.method === "POST") {
        let body;
        try { body = await readBody(req); } catch { return send(res, 400, { status: "error" }); }
        if (body.action === "confirmar") {
            if (rateLimited(ip, "confirmar")) return send(res, 429, { status: "demasiados_intentos" });
            const data = await callAppsScript(null, { action: "confirmar", token: tokenId(body.token) });
            return send(res, data.status === "timeout" ? 504 : 200, data, { "Cache-Control": "no-store" });
        }
        if (rateLimited(ip, "solicitud")) return send(res, 429, { status: "demasiados_intentos" });
        const data = await callAppsScript(null, {
            action: "solicitud",
            dni: docId(body.dni),
            nombre: clean(body.nombre),
            actividad: clean(body.actividad, 40),
            confirmado: body.confirmado === true,
        });
        return send(res, data.status === "timeout" ? 504 : 200, data, { "Cache-Control": "no-store" });
    }

    return send(res, 405, { status: "metodo_invalido" });
};
