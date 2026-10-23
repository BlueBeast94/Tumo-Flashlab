// ==========================================================
// TUMO Barracas FlashLabs — datos generales del evento
// Las actividades (cartelera) vienen de la planilla, vía /api/inscripcion.
// El chatbot también usa este archivo.
// ==========================================================

const API_URL = "/api/inscripcion";

const EVENT = {
    name: "FlashLabs de diciembre",
    center: "TUMO Barracas",
    dates: "jueves 10, viernes 11, martes 15 y jueves 17 de diciembre de 2026 (viernes 18: cierre y recuperatorio)",
    slots: "tres franjas: 9:00 a 11:00, 14:00 a 16:00 y 17:00 a 19:00 (cada actividad y grupo tiene la suya)",
    place: "TUMO Barracas",
    price: "Gratis",
    contact: "",  // mail o teléfono para casos que no se resuelven en la web (vacío = "acercate a recepción")
    rules: [
        "Cada estudiante puede solicitar vacante en una sola actividad de diciembre.",
        "Para inscribirse hay que elegir la actividad en la cartelera y completar nombre, apellido y DNI. No se pide el TUMO ID.",
        "El sistema verifica el DNI con los registros de TUMO y los requisitos de la actividad antes de registrar la solicitud.",
        "Recibir la solicitud no garantiza la vacante: el equipo de TUMO confirma las vacantes y se comunica después.",
        "Cada actividad y grupo tiene su propia capacidad. Si no hay vacantes, la solicitud entra en lista de espera por orden de llegada.",
        "Los grupos B se abren según la demanda.",
        "Para cambiar de actividad después de enviar la solicitud hay que contactar al equipo de TUMO.",
        "Las actividades son gratuitas.",
    ],
};

const contactText = () => EVENT.contact ? `escribinos a ${EVENT.contact}` : "acercate a la recepción de TUMO Barracas";

// Llama a la API con un límite de tiempo. Devuelve siempre un objeto con "status".
async function apiCall(params, body, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = body ? API_URL : `${API_URL}?${new URLSearchParams(params)}`;
        const res = await fetch(url, body ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        } : { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        return data.status ? data : { status: "error" };
    } catch (err) {
        return { status: err.name === "AbortError" ? "timeout" : "sin_conexion" };
    } finally {
        clearTimeout(timer);
    }
}

const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
