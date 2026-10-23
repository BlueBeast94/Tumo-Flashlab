// Llamada al Web App de Apps Script (la planilla). Compartido por inscripcion.js y chat.js.
// Los archivos que empiezan con "_" no se publican como endpoint en Vercel.
// Variables de entorno: APPS_SCRIPT_URL (URL /exec) y APPS_SCRIPT_KEY.

const TIMEOUT_MS = 15000;

const isConfigured = () => Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_KEY);

// params → GET con query string; body → POST. Siempre devuelve un objeto con "status".
async function callAppsScript(params, body, timeoutMs = TIMEOUT_MS) {
    const url = new URL(process.env.APPS_SCRIPT_URL);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let response;
        if (body) {
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ ...body, key: process.env.APPS_SCRIPT_KEY }),
                signal: controller.signal,
            });
        } else {
            Object.entries({ ...params, key: process.env.APPS_SCRIPT_KEY })
                .forEach(([k, v]) => url.searchParams.set(k, v));
            response = await fetch(url, { signal: controller.signal });
        }
        const text = await response.text();
        try { return JSON.parse(text); } catch { return { status: "error" }; }
    } catch (err) {
        return { status: err.name === "AbortError" ? "timeout" : "error" };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { callAppsScript, isConfigured };
