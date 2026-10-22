// ==========================================================
// TUMO Flash Lab — formulario de inscripción (inscripcion.html)
// Usa LABS, TURNOS y CONFIG de config.js
// ==========================================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);

const form = $("[data-signup]");

// ---------- Selección de lab y turno ----------

function renderLabs(selectedId) {
    $("[data-lab-picker]").innerHTML = LABS.map((lab) => `
        <label class="lab-option lab-option--${lab.color}">
            <input type="radio" name="lab" value="${lab.id}" ${lab.id === selectedId ? "checked" : ""} required>
            <span class="lab-option__icon">${lab.icon}</span>
            <span class="lab-option__name">${lab.name}</span>
            <span class="lab-option__check" aria-hidden="true">✓</span>
        </label>`).join("");
}

function renderTurnos() {
    const lab = findLab(form.lab.value);
    const available = lab ? lab.turnos : Object.keys(TURNOS);
    const current = form.turno ? form.turno.value : "";

    $("[data-turno-picker]").innerHTML = available.map((t) => `
        <label class="turno-option">
            <input type="radio" name="turno" value="${t}" ${t === current ? "checked" : ""} required>
            <span class="turno-option__code">${t}</span>
            <span class="turno-option__txt">${TURNOS[t].name}<br><small>${TURNOS[t].time}</small></span>
        </label>`).join("");
}

function updateSummary() {
    const lab = findLab(form.lab.value);
    const turno = TURNOS[form.turno ? form.turno.value : ""];
    $("[data-summary]").innerHTML = lab
        ? `Te estás inscribiendo a <strong>${lab.name}</strong>${turno ? ` · ${turno.name} (${turno.time})` : ""}`
        : "";
}

form.addEventListener("change", (e) => {
    if (e.target.name === "lab") renderTurnos();
    if (e.target.name === "lab" || e.target.name === "turno") {
        clearError(e.target.name);
        updateSummary();
    }
});

// ---------- Validación ----------

function showError(name, text) {
    const slot = $(`[data-error-for="${name}"]`);
    if (slot) slot.textContent = text;
}
function clearError(name) { showError(name, ""); }

function validate() {
    let ok = true;
    if (!form.lab.value)   { showError("lab", "Elegí un Flash Lab."); ok = false; }
    if (!form.turno || !form.turno.value) { showError("turno", "Elegí un horario."); ok = false; }

    $$(".field input", form).forEach((input) => {
        const field = input.closest(".field");
        const valid = input.checkValidity() && input.value.trim() !== "";
        field.classList.toggle("is-invalid", !valid);
        if (!valid) ok = false;
    });

    const auth = form.autorizacion;
    auth.closest(".check").classList.toggle("is-invalid", !auth.checked);
    if (!auth.checked) ok = false;

    return ok;
}

$$(".field input", form).forEach((input) => {
    input.addEventListener("input", () => input.closest(".field").classList.remove("is-invalid"));
});
form.documento.addEventListener("input", () => {
    form.documento.value = form.documento.value.replace(/\D/g, "").slice(0, 8);
});

// ---------- Envío ----------

const SUBMIT_MSG = {
    duplicate: "Este documento ya tiene una inscripción activa. Cada participante puede tener un solo lugar.",
    error: "No pudimos enviar la inscripción. Probá de nuevo en un rato.",
};

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("[data-form-msg]");
    msg.textContent = "";

    if (!validate()) {
        msg.textContent = "Revisá los campos marcados.";
        const first = $(".is-invalid, .field__error:not(:empty)", form);
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }

    const data = Object.fromEntries(new FormData(form));
    data.autorizacion = true;
    const button = $("button[type=submit]", form);
    button.disabled = true;
    button.textContent = "Enviando…";

    try {
        const result = await submitRegistration(data);
        if (result.status === "ok") {
            showDone(data);
        } else {
            msg.textContent = SUBMIT_MSG[result.status] || SUBMIT_MSG.error;
        }
    } catch (err) {
        console.error(err);
        msg.textContent = SUBMIT_MSG.error;
    } finally {
        button.disabled = false;
        button.textContent = "Enviar inscripción";
    }
});

async function submitRegistration(data) {
    if (!CONFIG.API_URL) {
        console.info("Modo demo: inscripción no enviada", data);
        return { status: "ok" };
    }
    // text/plain evita el preflight CORS que Apps Script no responde
    const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "register", ...data }),
    });
    return res.json();
}

function showDone(data) {
    const lab = findLab(data.lab);
    form.hidden = true;
    $("[data-done-text]").innerHTML =
        `${data.nombre} quedó preinscripto/a en <strong>${lab.name}</strong> · ${TURNOS[data.turno].name}.`;
    $("[data-done]").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Consultar estado ----------

const STATUS_TEXT = {
    registered: ["Recibimos la inscripción. Revisá tu mail para confirmar.", "is-warn"],
    confirmed:  ["¡Confirmado! Tenés tu lugar asegurado.", "is-ok"],
    waitlist:   ["Confirmaste, pero estás en lista de espera. Te avisamos si se libera un lugar.", "is-warn"],
    expired:    ["El lugar se liberó porque no se confirmó a tiempo.", "is-warn"],
    not_found:  ["No encontramos ese documento. ¿Ya completaste el formulario?", "is-warn"],
};

$("[data-status-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("[data-status-result]");
    const dni = $("#status-dni").value.replace(/\D/g, "");
    out.className = "status__result";

    if (!CONFIG.API_URL) {
        out.textContent = "Modo demo: todavía no está conectada la planilla.";
        out.classList.add("is-warn");
        return;
    }
    out.textContent = "Buscando…";
    try {
        const res = await fetch(`${CONFIG.API_URL}?action=status&dni=${encodeURIComponent(dni)}`);
        const { status } = await res.json();
        const [text, cls] = STATUS_TEXT[status] || STATUS_TEXT.not_found;
        out.textContent = text;
        out.classList.add(cls);
    } catch (err) {
        out.textContent = "Hubo un problema al consultar. Probá de nuevo en un rato.";
        out.classList.add("is-warn");
    }
});

// ---------- Inicio: autoseleccionar el lab de la URL (?lab=videojuegos) ----------

const preselected = new URLSearchParams(location.search).get("lab");
renderLabs(findLab(preselected) ? preselected : "");
renderTurnos();
updateSummary();
