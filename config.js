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

// ---------- Días y horario como "calendario" ----------
// Lee el texto de la columna Días de la planilla, por ejemplo:
// "Jue 10, Vie 11, Mar 15 y Jue 17 de diciembre (Vie 18: cierre y recuperatorio)"
// Lo que está entre paréntesis se muestra como día especial (borde punteado) con su nota.

const DOW = { lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom" };
const plainText = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function parseDias(text) {
    const [main, extra = ""] = String(text || "").split("(");
    const re = /\b(lun|mar|mi[eé]|jue|vie|s[aá]b|dom)[a-záéíóú]*\.?\s+(\d{1,2})\b/gi;
    const pick = (part, isExtra) => [...part.matchAll(re)].map((m) => ({
        dow: DOW[plainText(m[1]).slice(0, 3)], num: m[2], extra: isExtra,
    }));
    const month = (plainText(main).match(/de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/) || [])[1];
    const note = (extra.match(/:\s*([^)]+)/) || [])[1];
    return { days: [...pick(main, false), ...pick(extra, true)], month: month || "", note: note ? note.trim() : "" };
}

const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';

// size: "sm" (tarjetas, diálogo) | "md" (panel, formulario)
function scheduleHtml(act, size = "md") {
    const time = escapeHtml(String(act.horario || "").replace(/\s+a\s+/i, " – "));
    const timeBadge = `<span class="sched__time">${CLOCK}${time}</span>`;
    const { days, month, note } = parseDias(act.dias);
    if (!days.length) {
        return `<div class="sched sched--${size}">${timeBadge}<p class="sched__text">${escapeHtml(act.dias)}</p></div>`;
    }
    // En la versión chica no hay leyenda: el día especial lleva la primera palabra de su nota ("Cierre")
    const shortNote = note ? capitalize(note.split(/\s+/)[0]).slice(0, 8) : "";
    const tiles = days.map((d) => {
        const label = d.extra && size === "sm" && shortNote ? shortNote : d.dow;
        const title = d.extra && note ? ` title="${escapeHtml(capitalize(note))}"` : "";
        return `<span class="day${d.extra ? " day--extra" : ""}"${title}><small>${escapeHtml(label)}</small><b>${d.num}</b></span>`;
    }).join("");
    if (size === "sm") {
        return `<div class="sched sched--sm" role="group" aria-label="${escapeHtml(act.dias)}, ${time}">
            ${timeBadge}<div class="sched__days">${tiles}</div></div>`;
    }
    const legend = [
        month ? `<span>${capitalize(month)}</span>` : "",
        note ? `<span><i class="day-key"></i>${escapeHtml(capitalize(note))}</span>` : "",
    ].filter(Boolean).join("");
    return `<div class="sched sched--${size}" role="group" aria-label="${escapeHtml(act.dias)}, ${time}">
        ${timeBadge}
        <div class="sched__days">${tiles}</div>
        ${legend ? `<p class="sched__legend">${legend}</p>` : ""}
    </div>`;
}
