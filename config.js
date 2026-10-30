// ==========================================================
// TUMO Barracas FlashLabs — datos generales del evento
// Las actividades (cartelera) vienen de la planilla, vía /api/inscripcion.
// El chatbot también usa este archivo.
// ==========================================================

// Abierto con un servidor local sin /api (Live Server de VS Code, etc.): se usa la API publicada.
// 5173 es el servidor de pruebas del proyecto, que sí tiene /api. (api/chat.js también lee este archivo: ahí no hay location.)
// También sirve abriendo index.html con doble clic (file://).
const API_BASE = typeof location !== "undefined" && (location.protocol === "file:" ||
    (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== "5173"))
    ? "https://tumoflashlab.vercel.app"
    : "";
const API_URL = `${API_BASE}/api/inscripcion`;

const EVENT = {
    name: "FlashLabs de diciembre",
    center: "TUMO Barracas",
    dates: "del jueves 10 al jueves 17 de diciembre de 2026 (encuentros: jueves 10, viernes 11, martes 15 y jueves 17)",
    slots: "tres franjas: 9:00 a 11:00, 14:00 a 16:00 y 17:00 a 19:00 (cada actividad y grupo tiene la suya)",
    place: "TUMO Barracas",
    price: "Gratis",
    contact: "",  // mail o teléfono para casos que no se resuelven en la web (vacío = "acercate a recepción")
    // WhatsApp para seguir la consulta con una persona (Flashy lo ofrece). Sólo números, con código de país:
    // en Argentina los celulares llevan 54 + 9 + código de área sin 0 + número (+54 11 5134-2592 → 5491151342592)
    whatsapp: "5491151342592",
    whatsappText: "Hola, necesito más información del FlashLab",
    rules: [
        "Cada estudiante puede solicitar vacante en una sola actividad de diciembre.",
        "Para inscribirse hay que elegir la actividad en la cartelera y completar el nombre, el apellido y el DNI del estudiante que va a participar (no los del adulto responsable). No se pide el TUMO ID.",
        "El sistema verifica el DNI con los registros de TUMO y los requisitos de la actividad antes de registrar la solicitud.",
        "Enviar la solicitud es una pre-inscripción: no garantiza la vacante. El equipo de TUMO confirma las vacantes por mail.",
        "Cada actividad y grupo tiene su propia capacidad. Si no hay vacantes, la solicitud entra en lista de espera por orden de llegada.",
        "Los grupos B se abren según la demanda.",
        "Las actividades son gratuitas.",
    ],
    // Las mismas preguntas frecuentes de index.html: Flashy las usa para responder igual que la página.
    // Si cambiás una respuesta en la página, cambiala también acá.
    faq: [
        ["¿Cuándo son los FlashLabs?", "Del jueves 10 al jueves 17 de diciembre."],
        ["¿Qué datos me piden?", "El nombre, el apellido y el DNI del estudiante que va a participar."],
        ["¿Puedo participar si no cumplo con los prerrequisitos?",
            "Es necesario cumplir con los prerrequisitos para participar. Te recomendamos volver a la cartelera y elegir otro FlashLab."],
        ["Si me llega el mensaje de recepción, ¿ya tengo la vacante?",
            "No. Ese mensaje confirma la pre-inscripción, que depende de los requisitos de la actividad y de los cupos disponibles. " +
            "La vacante se obtiene sólo si llega el mail de confirmación de la vacante y se responde. Hay 5 días para responderlo: " +
            "si no se responde, se da de baja la inscripción y la vacante pasa a otra persona."],
        ["¿Me puedo anotar en más de una actividad?", "No. Cada estudiante puede solicitar vacante en una sola actividad."],
        ["¿Qué pasa si no hay vacantes?",
            "Quedás en lista de espera. Cuando se libere un lugar te avisamos por mail: hay que estar atento para confirmarlo. " +
            "También podés elegir otro FlashLab que sí tenga vacantes en la cartelera."],
        ["¿Y si quiero cambiar de actividad?", "Escribinos a familias.cmd@tumo.ar y ahí te ayudamos a hacer el cambio."],
        ["¿Cuál es el estado de mi solicitud?",
            "Se consulta con el DNI del estudiante en las preguntas frecuentes de la página o preguntándole a Flashy."],
    ],
};

// Abre WhatsApp con el mensaje ya escrito
const whatsappUrl = () => `https://wa.me/${EVENT.whatsapp}?text=${encodeURIComponent(EVENT.whatsappText)}`;

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
// DNI, pasaporte u otro documento: sólo letras y números ("40.123.456" → "40123456", "aab 123" → "AAB123")
const cleanDoc = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

// ID de la actividad sin el grupo: "musica-cine-b" → "musica-cine" (los grupos comparten todo menos el horario)
const baseId = (act) => String(act.id).replace(/-[a-z]$/, "");

// Requisitos como lista con ✓: "✓ Nivel 1 de Música – Aprobado". Con varios, alcanza con uno.
// Si la planilla todavía no manda los cursos, se usa el texto de "Requisito" sin el "Tener" del principio.
function requisitoHtml(act) {
    const cursos = act.cursosRequisito || [];
    if (!cursos.length) {
        const text = String(act.requisito || "").replace(/^tener\s+/i, "");
        return text ? escapeHtml(text.charAt(0).toUpperCase() + text.slice(1)) : "Sin requisitos previos";
    }
    return `<ul class="req-list">${cursos.map((c) => `<li>${escapeHtml(c)} – Aprobado</li>`).join("")}</ul>` +
        (cursos.length > 1 ? '<p class="req-list__hint">Alcanza con uno</p>' : "");
}

// "9:00 a 11:00" → "9:00 – 11:00"
const timeText = (horario) => String(horario || "").replace(/\s+a\s+/i, " – ");

// extra: HTML opcional que va en la misma fila que el horario (el estado, en las tarjetas)
// act.horarios (opcional): varios horarios, uno por grupo; [] = sin horario (se elige aparte)
function scheduleHtml(act, size = "md", extra = "") {
    const times = (act.horarios || [act.horario]).map(timeText);
    const time = escapeHtml(times.join(" o "));
    const timeBadge = times.map((t) => `<span class="sched__time">${CLOCK}${escapeHtml(t)}</span>`).join("");
    const { days, month, note } = parseDias(act.dias);
    if (!days.length) {
        return `<div class="sched sched--${size}">${timeBadge}<p class="sched__text">${escapeHtml(act.dias)}</p></div>`;
    }
    // En la versión chica no hay leyenda: el día especial lleva la primera palabra de su nota ("Cierre")
    const shortNote = note ? capitalize(note.split(/\s+/)[0]).slice(0, 8) : "";
    // El día de cierre (vie 18) no se muestra en ningún lado por ahora.
    // Para volver a mostrarlo: const shown = size === "sm" ? days.filter((d) => !d.extra) : days; (sólo en el detalle)
    // o const shown = days; (en todos lados)
    const shown = days.filter((d) => !d.extra);
    const showNote = shown.some((d) => d.extra); // la leyenda "Cierre y recuperatorio" sólo si se ve ese día
    const tiles = shown.map((d) => {
        const label = d.extra && size === "sm" && shortNote ? shortNote : d.dow;
        const title = d.extra && note ? ` title="${escapeHtml(capitalize(note))}"` : "";
        return `<span class="day${d.extra ? " day--extra" : ""}"${title}><small>${escapeHtml(label)}</small><b>${d.num}</b></span>`;
    }).join("");
    if (size === "sm") {
        return `<div class="sched sched--sm" role="group" aria-label="${escapeHtml(act.dias)}, ${time}">
            ${timeBadge || extra ? `<div class="sched__row${times.length > 1 ? " sched__row--multi" : ""}">${timeBadge}${extra}</div>` : ""}<div class="sched__days">${tiles}</div></div>`;
    }
    const legend = [
        month ? `<span>${capitalize(month)}</span>` : "",
        note && showNote ? `<span><i class="day-key"></i>${escapeHtml(capitalize(note))}</span>` : "",
    ].filter(Boolean).join("");
    return `<div class="sched sched--${size}" role="group" aria-label="${escapeHtml(act.dias)}, ${time}">
        ${timeBadge ? `<div class="sched__row">${timeBadge}</div>` : ""}
        <div class="sched__days">${tiles}</div>
        ${legend ? `<p class="sched__legend">${legend}</p>` : ""}
    </div>`;
}
