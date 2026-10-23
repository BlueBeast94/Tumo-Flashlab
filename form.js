// ==========================================================
// TUMO Barracas FlashLabs — solicitud de vacante (inscripcion.html?actividad=<id>)
// Usa apiCall, EVENT, contactText y escapeHtml de config.js
// ==========================================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);

const form = $("[data-signup]");
const nameInput = form.nombre;
const dniInput = form.dni;
const SLOW_MS = 6000;
const DNI_HINT = "Lo usamos para identificarte en los registros de TUMO.";

let act = null;

// ---------- Vistas ----------

function show(view) {
    $$("[data-view]").forEach((el) => { el.hidden = el.dataset.view !== view; });
}

const TO_CARTELERA = { label: "Ver la cartelera", href: "index.html#actividades", cls: "btn--blue" };

function showMessage(text, actions = [TO_CARTELERA]) {
    $("[data-message]").innerHTML = text;
    const wrap = $("[data-message-actions]");
    wrap.innerHTML = "";
    actions.forEach((a) => {
        const el = document.createElement(a.href ? "a" : "button");
        el.className = `btn ${a.cls || "btn--ghost"}`;
        el.textContent = a.label;
        if (a.href) el.href = a.href; else { el.type = "button"; el.addEventListener("click", a.onClick); }
        wrap.appendChild(el);
    });
    show("message");
}

const actName = () => `<strong>${escapeHtml(act.nombre)}</strong> (grupo ${escapeHtml(act.grupo)})`;
const actWhen = () => `${escapeHtml(act.dias)}, ${escapeHtml(act.horario)}`;

// ---------- Carga de la actividad ----------

const LOAD_ERRORS = {
    timeout: "La página está tardando más de lo esperado.",
    no_configurado: "La inscripción todavía no está habilitada.",
    demasiados_intentos: "Hubo demasiados intentos seguidos. Esperá un minuto.",
};

async function init() {
    const id = new URLSearchParams(location.search).get("actividad");
    if (!id) return showMessage("Para solicitar una vacante, primero elegí una actividad en la cartelera.");

    const slow = setTimeout(() => { $("[data-loading-text]").textContent = "Está tardando más de lo esperado…"; }, SLOW_MS);
    const data = await apiCall({ action: "actividades" });
    clearTimeout(slow);

    if (data.status !== "ok") {
        return showMessage(`${LOAD_ERRORS[data.status] || "No pudimos cargar la actividad."} Actualizá para probar de nuevo.`,
            [{ label: "Reintentar", cls: "btn--blue", onClick: () => location.reload() }, { ...TO_CARTELERA, cls: "btn--ghost" }]);
    }
    act = (data.actividades || []).find((a) => a.id === id);
    if (!act) return showMessage("Esta actividad no está disponible. Elegí otra en la cartelera.");
    if (act.estado === "cerrada") return showMessage(`La inscripción a ${actName()} está cerrada.`);

    fillChosen();
    show("form");
    openConfirm();
}

function fillChosen() {
    const espera = act.estado === "espera";
    document.title = `${act.nombre} · Solicitar vacante · TUMO Barracas`;
    $("[data-chosen-name]").textContent = act.nombre;
    $("[data-chosen-meta]").textContent = `${act.tipo} · Grupo ${act.grupo}`;
    $("[data-chosen-dias]").textContent = act.dias;
    $("[data-chosen-horario]").textContent = act.horario;
    $("[data-chosen-requisito]").textContent = act.requisito || "Sin requisitos previos";
    $("[data-chosen-waitlist]").hidden = !espera;
    $("[data-confirm-text]").innerHTML =
        `Confirmo que quiero solicitar ${espera ? "un lugar en la lista de espera" : "una vacante"} en ${actName()}, ${actWhen()}.`;
}

// Confirmación 1: al llegar con la actividad elegida
function openConfirm() {
    const dialog = $("[data-confirm]");
    $("[data-confirm-name]").textContent = `${act.nombre} (grupo ${act.grupo})`;
    $("[data-confirm-meta]").textContent = `${act.dias} · ${act.horario}`;
    $("[data-confirm-waitlist]").hidden = act.estado !== "espera";
    dialog.addEventListener("cancel", (e) => e.preventDefault()); // hay que elegir una de las dos opciones
    $("[data-confirm-yes]").addEventListener("click", () => {
        dialog.close();
        nameInput.focus();
    });
    dialog.showModal();
}

// ---------- Verificación del DNI en tiempo real ----------

const verify = { seq: 0, dni: "", result: null, timer: null };

function setVerify(state, html) {
    $("[data-verify]").className = `verify verify--${state}`;
    $("[data-verify-text]").innerHTML = html;
    $("[data-field='dni']").classList.toggle("is-invalid", state === "error");
}

const retryButton = '<button type="button" class="verify__retry" data-retry>Probar de nuevo</button>';

function verifyMessage(r) {
    switch (r.status) {
        case "ok":
            return ["ok", r.lugar === "espera"
                ? "DNI verificado. No quedan vacantes: vas a entrar en lista de espera."
                : "DNI verificado."];
        case "sin_verificar":
            return ["warn", `DNI verificado, pero no pudimos comprobar el requisito${r.motivo ? ` (${escapeHtml(r.motivo)})` : ""}. ` +
                "Podés enviar la solicitud: el equipo de TUMO lo va a revisar antes de confirmarla."];
        case "no_encontrado":
            return ["error", `No encontramos este DNI en los registros de TUMO. Revisá que esté bien escrito. Si es correcto, ${contactText()}.`];
        case "activa":
            return ["error", `Este documento ya tiene una inscripción activa. Cada estudiante puede solicitar una sola actividad. Para cambiarla, ${contactText()}.`];
        case "no_cumple":
            return ["error", `No cumplís el requisito de esta actividad${r.motivo ? `: ${escapeHtml(r.motivo)}` : ""}.`];
        case "cerrada":
            return ["error", "La inscripción a esta actividad se cerró."];
        case "actividad_invalida":
            return ["error", "Esta actividad ya no está disponible. Elegí otra en la cartelera."];
        case "dni_invalido":
            return ["error", "El DNI tiene que tener 7 u 8 números."];
        case "timeout":
            return ["error", `La verificación está tardando más de lo esperado. ${retryButton} o actualizá la página.`];
        case "demasiados_intentos":
            return ["error", `Hiciste muchas consultas seguidas. Esperá un minuto y ${retryButton.replace("Probar de nuevo", "probá de nuevo")}.`];
        default:
            return ["error", `No pudimos verificar el DNI en este momento. ${retryButton}`];
    }
}

async function runVerify(dni) {
    const seq = ++verify.seq;
    verify.result = null;
    setVerify("checking", "Verificando…");
    const slow = setTimeout(() => {
        if (seq === verify.seq) setVerify("checking", "Verificando… está tardando más de lo esperado.");
    }, SLOW_MS);

    const r = await apiCall({ action: "verificar", dni, actividad: act.id });
    clearTimeout(slow);
    if (seq !== verify.seq) return; // el DNI cambió mientras tanto

    verify.result = r;
    verify.dni = dni;
    setVerify(...verifyMessage(r));
    if (r.status === "ok" || r.status === "sin_verificar") checkName();
}

dniInput.addEventListener("input", () => {
    const dni = dniInput.value.replace(/\D/g, "").slice(0, 8);
    dniInput.value = dni;
    clearTimeout(verify.timer);
    verify.seq++; // descarta cualquier verificación en curso
    verify.result = null;
    nameCheck.seq++; // y la del nombre, que dependía del DNI anterior
    nameCheck.checked = "";
    nameCheck.result = "";
    setNameHint("", "");

    if (dni.length < 7) {
        setVerify("idle", dni.length ? "El DNI tiene 7 u 8 números." : DNI_HINT);
        return;
    }
    setVerify("checking", "Verificando…");
    verify.timer = setTimeout(() => runVerify(dni), 600);
});

$("[data-verify]").addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) runVerify(dniInput.value);
});

// ---------- Nombre: se compara con el registrado para ese DNI ----------

const nameCheck = { seq: 0, checked: "", result: "" };
const nameWords = () => nameInput.value.trim().split(/\s+/).filter(Boolean);

function setNameHint(state, text) {
    const hint = $("[data-hint='nombre']");
    hint.className = `field__hint ${state ? `field__hint--${state}` : ""}`;
    hint.textContent = text;
    $("[data-field='nombre']").classList.toggle("is-invalid", state === "error");
}

async function checkName() {
    const typed = nameInput.value.trim();
    const verified = verify.result && ["ok", "sin_verificar"].includes(verify.result.status);
    if (!verified || nameWords().length < 2 || typed === nameCheck.checked) return;

    const seq = ++nameCheck.seq;
    setNameHint("checking", "Revisando el nombre…");
    const r = await apiCall({ action: "verificar", dni: verify.dni, actividad: act.id, nombre: typed });
    if (seq !== nameCheck.seq) return;

    nameCheck.checked = typed;
    nameCheck.result = r.status;
    if (r.status === "no_coincide") {
        setNameHint("error", "El nombre no coincide con el registrado para este DNI. Escribilo como figura en TUMO.");
    } else if (r.status === "ok" || r.status === "sin_verificar") {
        setNameHint("ok", "Nombre verificado.");
    } else {
        setNameHint("", ""); // otros problemas ya se muestran en el DNI; se revisa todo al enviar
        nameCheck.checked = "";
    }
}

nameInput.addEventListener("input", () => {
    nameCheck.seq++;
    nameCheck.checked = "";
    nameCheck.result = "";
    setNameHint("", "");
});
nameInput.addEventListener("blur", checkName);

// ---------- Envío (confirmación 3) ----------

function formError(text) {
    $("[data-form-msg]").innerHTML = text;
}

form.confirmo.addEventListener("change", () => {
    $("[data-field='confirmo']").classList.remove("is-invalid");
    formError("");
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError("");

    if (nameWords().length < 2) {
        setNameHint("error", "Escribí tu nombre y apellido.");
        nameInput.focus();
        return formError("Revisá tu nombre y apellido.");
    }
    if (nameCheck.result === "no_coincide") return formError("El nombre no coincide con el registrado para este DNI.");
    const r = verify.result;
    if (!r || verify.dni !== dniInput.value) {
        if (dniInput.value.length < 7) setVerify("error", "Escribí tu DNI (7 u 8 números).");
        return formError(dniInput.value.length >= 7 ? "Esperá a que termine la verificación del DNI." : "Revisá tu DNI.");
    }
    if (!["ok", "sin_verificar"].includes(r.status)) return formError("Revisá el mensaje del DNI antes de enviar.");
    if (!form.confirmo.checked) {
        $("[data-field='confirmo']").classList.add("is-invalid");
        return formError("Marcá la confirmación para enviar tu solicitud.");
    }

    const button = $("[data-submit]");
    button.disabled = true;
    button.textContent = "Enviando…";
    const slow = setTimeout(() => formError("Está tardando más de lo esperado. No cierres la página…"), 8000);

    const result = await apiCall({}, {
        action: "solicitud",
        dni: dniInput.value,
        nombre: nameInput.value.trim(),
        actividad: act.id,
        confirmado: true,
    });
    clearTimeout(slow);
    button.disabled = false;
    button.textContent = "Enviar solicitud";

    if (result.status === "ok") return showDone(result);

    if (result.status === "no_coincide") {
        setNameHint("error", "El nombre no coincide con el registrado para este DNI. Escribilo como figura en TUMO.");
        return formError("El nombre no coincide con el registrado para este DNI.");
    }
    if (result.status === "activa") {
        return formError("Este documento ya tiene una solicitud activa. Si recién la enviaste, ya quedó registrada: " +
            '<a href="#estado">consultá su estado</a>.');
    }
    if (result.status === "timeout") {
        return formError("No pudimos confirmar el envío porque está tardando más de lo esperado. " +
            "Probá de nuevo: si tu solicitud ya se registró, te lo vamos a indicar.");
    }
    // Cualquier otro caso: NO se muestra la recepción
    formError(verifyMessage(result)[1].replace(retryButton, "Probá de nuevo."));
});

function showDone(result) {
    const detail = {
        "Lista de espera": `Por ahora quedaste en <strong>lista de espera</strong> de ${actName()}: todavía no tenés vacante. Si se libera una, te contactamos.`,
        "En validación": `Antes de confirmarte una vacante en ${actName()}, el equipo va a revisar el requisito de la actividad.`,
    }[result.estado] || `Solicitaste vacante en ${actName()}, ${actWhen()}. Tu vacante todavía no está confirmada.`;
    $("[data-done-detail]").innerHTML = detail;
    show("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Consultar estado ----------

$("[data-status-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("[data-status-result]");
    const dni = $("#status-dni").value.replace(/\D/g, "");
    out.className = "status__result";
    out.textContent = "Buscando…";
    const r = await apiCall({ action: "estado", dni });
    if (r.status === "ok") {
        out.textContent = r.mensaje;
        out.classList.add(r.estado === "Confirmada" ? "is-ok" : "is-warn");
    } else if (r.status === "no_encontrado") {
        out.textContent = "No encontramos solicitudes con ese DNI.";
        out.classList.add("is-warn");
    } else {
        out.textContent = r.status === "timeout"
            ? "Está tardando más de lo esperado. Probá de nuevo en un rato."
            : "No pudimos consultar ahora. Probá de nuevo en un rato.";
        out.classList.add("is-warn");
    }
});

init();
