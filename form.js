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

let act = null;     // grupo elegido (una fila de la planilla); null hasta que se elige el horario
let info = null;    // datos comunes de la actividad (nombre, días, requisito: iguales en todos los grupos)
let grupos = [];    // grupos de la actividad con inscripción abierta o en lista de espera

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

// El grupo (A/B) no se muestra a las familias: antes era `… (grupo ${act.grupo})`
const actName = () => `<strong>${escapeHtml(info.nombre)}</strong>`;
const actWhen = () => `de ${escapeHtml(act.horario)}`; // los días se ven en el calendario de arriba

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
    // ?actividad= puede ser un grupo ("musica-cine-a", queda preelegido) o la actividad ("musica-cine")
    const rows = data.actividades || [];
    const target = rows.find((a) => a.id === id);
    const base = target ? baseId(target) : id;
    const todos = rows.filter((a) => baseId(a) === base)
        .sort((a, b) => String(a.grupo).localeCompare(String(b.grupo)));
    if (!todos.length) return showMessage("Esta actividad no está disponible. Elegí otra en la cartelera.");
    info = todos[0];
    grupos = todos.filter((g) => g.estado !== "cerrada");
    if (!grupos.length) return showMessage(`La inscripción a ${actName()} está cerrada.`);
    act = target && target.estado !== "cerrada" ? target : grupos.length === 1 ? grupos[0] : null;

    fillChosen();
    show("form");
    openConfirm();
}

function fillChosen() {
    document.title = `${info.nombre} · Solicitar vacante · TUMO Barracas`;
    $("[data-chosen-name]").textContent = info.nombre;
    $("[data-chosen-meta]").textContent = info.tipo; // sin el grupo: `${act.tipo} · Grupo ${act.grupo}`
    const multi = grupos.length > 1;
    // Con varios horarios, el horario se elige abajo; acá sólo van los días
    $("[data-chosen-sched]").innerHTML = scheduleHtml({ ...info, horarios: multi ? [] : [grupos[0].horario] }, "md");
    $("[data-chosen-requisito]").innerHTML = requisitoHtml(info);
    $("[data-horario]").hidden = !multi;
    // Lista desplegable: empieza en "Seleccioná" (salvo que se haya llegado con un grupo ya elegido)
    $("[data-horario-select]").innerHTML = '<option value="">Seleccioná</option>' + grupos.map((g) =>
        `<option value="${escapeHtml(g.id)}" ${act && act.id === g.id ? "selected" : ""}>` +
        `${escapeHtml(timeText(g.horario))}${g.estado === "espera" ? " (lista de espera)" : ""}</option>`).join("");
    updateChoice();
}

// Lo que depende del horario elegido: aviso de lista de espera y texto de la confirmación 3
function updateChoice() {
    const espera = Boolean(act && act.estado === "espera");
    $("[data-chosen-waitlist]").hidden = !espera;
    $("[data-horario-msg]").textContent = "";
    $("[data-horario]").classList.remove("is-invalid");
    $("[data-confirm-text]").innerHTML =
        `Confirmo que quiero solicitar ${espera ? "un lugar en la lista de espera" : "una vacante"} en ${actName()}` +
        (act ? `, ${actWhen()}.` : ".");
}

$("[data-horario-select]").addEventListener("change", (e) => {
    act = grupos.find((g) => g.id === e.target.value) || null;
    updateChoice();
    // El lugar (vacante o lista de espera) depende del horario: se vuelve a verificar
    if (dniInput.value.length >= MIN_DOC) runVerify(dniInput.value);
});

// Confirmación 1: al llegar con la actividad elegida
function openConfirm() {
    const dialog = $("[data-confirm]");
    $("[data-confirm-name]").textContent = info.nombre; // sin el grupo: `${act.nombre} (grupo ${act.grupo})`
    const opciones = act ? [act] : grupos;
    $("[data-confirm-meta]").innerHTML = scheduleHtml({ ...info, horarios: opciones.map((g) => g.horario) }, "sm") +
        (opciones.length > 1 ? '<p class="confirm__hint">El horario lo elegís en el formulario.</p>' : "");
    $("[data-confirm-waitlist]").hidden = !opciones.every((g) => g.estado === "espera");
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
                ? "Documento verificado. No quedan vacantes: vas a entrar en lista de espera."
                : "Documento verificado."];
        case "sin_verificar":
            return ["warn", `Documento verificado, pero no pudimos comprobar el requisito${r.motivo ? ` (${escapeHtml(r.motivo)})` : ""}. ` +
                "Podés enviar la solicitud: el equipo de TUMO lo va a revisar antes de confirmarla."];
        case "no_encontrado":
            return ["error", `No encontramos este documento en los registros de TUMO. Revisá que esté bien escrito. Si es correcto, ${contactText()}.`];
        case "activa":
            return ["error", `Este documento ya tiene una inscripción activa. Cada estudiante puede solicitar una sola actividad. Para cambiarla, ${contactText()}.`];
        case "no_cumple":
            return ["warn", "Documento verificado. Todavía no cumplís el requisito: igual podés enviar la solicitud, " +
                "pero vas a quedar detrás de quienes los cumplen."];
        case "cerrada":
            return ["error", "La inscripción a esta actividad se cerró."];
        case "actividad_invalida":
            return ["error", "Esta actividad ya no está disponible. Elegí otra en la cartelera."];
        case "dni_invalido":
            return ["error", "El documento tiene que tener entre 6 y 12 letras o números."];
        case "timeout":
            return ["error", `La verificación está tardando más de lo esperado. ${retryButton} o actualizá la página.`];
        case "demasiados_intentos":
            return ["error", `Hiciste muchas consultas seguidas. Esperá un minuto y ${retryButton.replace("Probar de nuevo", "probá de nuevo")}.`];
        default:
            return ["error", `No pudimos verificar el documento en este momento. ${retryButton}`];
    }
}

// Detalle del requisito para ese documento: cada curso con su estado y el resultado final
const REQ_LABEL = { ok: "Aprobado", no: "No aprobado", unknown: "Sin datos" };

function renderRequirements(r) {
    const box = $("[data-req]");
    const req = r && r.requisitos;
    if (!req || !req.cursos || !req.cursos.length) {
        box.hidden = true;
        box.innerHTML = "";
        return;
    }
    const several = req.cursos.length > 1;
    // Sólo se aclara cuando alcanza con uno; si hacen falta todos, los ✓ / ✕ ya lo dicen
    const hint = several && req.modo === "any" ? "alcanza con tener uno aprobado" : "";
    // Qué le falta: en "todos" los no aprobados; en "alcanza con uno", cualquiera de la lista
    const missing = req.cursos.filter((c) => c.estado !== "ok").map((c) => c.curso);
    const join = (list, last) => list.length > 1 ? `${list.slice(0, -1).join(", ")} ${last} ${list[list.length - 1]}` : list[0];
    const notYet = (req.modo === "any" && several
        ? `Todavía no cumplís el requisito: necesitás tener aprobado ${join(missing, "o")}.`
        : `Todavía no cumplís el requisito: te falta aprobar ${join(missing, "y")}.`) +
        " Igual podés enviar la solicitud: tienen prioridad quienes cumplen los requisitos.";
    const verdict = {
        ok: ["ok", "¡Cumplís el requisito! Podés solicitar vacante en esta actividad."],
        // Amarillo, no rojo: no cumplir no bloquea, sólo baja la prioridad
        no_cumple: ["unknown", missing.length ? notYet : "Todavía no cumplís el requisito de esta actividad."],
    }[r.status] || ["unknown", req.sinHistorial
        ? "No encontramos tu historial de cursos. Podés enviar la solicitud y el equipo de TUMO lo va a revisar."
        : "No pudimos confirmar todos los cursos. Podés enviar la solicitud y el equipo de TUMO lo va a revisar."];

    box.innerHTML = `
        <p class="req-check__title">Requisitos${hint ? ` <span>(${hint})</span>` : ""}</p>
        <ul class="req-check__list">
            ${req.cursos.map((c) => `
                <li class="req req--${c.estado}">
                    <span class="req__icon" aria-hidden="true"></span>
                    <span class="req__name">${escapeHtml(c.curso)}</span>
                    <span class="req__state">${REQ_LABEL[c.estado] || REQ_LABEL.unknown}</span>
                </li>`).join("")}
        </ul>
        <p class="req-check__verdict req--${verdict[0]}">${verdict[1]}</p>`;
    box.hidden = false;
}

async function runVerify(dni) {
    const seq = ++verify.seq;
    verify.result = null;
    renderRequirements(null);
    setVerify("checking", "Verificando…");
    const slow = setTimeout(() => {
        if (seq === verify.seq) setVerify("checking", "Verificando… está tardando más de lo esperado.");
    }, SLOW_MS);

    // Sin horario elegido todavía se verifica con el primero: el requisito es el mismo en todos los grupos
    const forId = (act || grupos[0]).id;
    const r = await apiCall({ action: "verificar", dni, actividad: forId });
    clearTimeout(slow);
    if (seq !== verify.seq) return; // el DNI o el horario cambiaron mientras tanto

    if (!act && r.lugar) delete r.lugar; // vacante o lista de espera depende del horario: todavía no se sabe
    verify.result = r;
    verify.dni = dni;
    verify.forId = forId;
    setVerify(...verifyMessage(r));
    renderRequirements(r);
}

// DNI, pasaporte u otro documento: sólo letras y números ("40.123.456" → "40123456", "aab 123" → "AAB123")
const cleanDoc = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const MIN_DOC = 6;

dniInput.addEventListener("input", () => {
    const dni = cleanDoc(dniInput.value);
    if (dniInput.value !== dni) dniInput.value = dni;
    clearTimeout(verify.timer);
    verify.seq++; // descarta cualquier verificación en curso
    verify.result = null;
    renderRequirements(null);

    if (dni.length < MIN_DOC) {
        setVerify("idle", dni.length ? "Seguí escribiendo tu documento…" : DNI_HINT);
        return;
    }
    // Un DNI suele tener 7-8 números: con menos, esperamos a que deje de escribir un poco más
    const wait = /^\d+$/.test(dni) && dni.length < 7 ? 1500 : 700;
    setVerify("checking", "Verificando…");
    verify.timer = setTimeout(() => runVerify(dni), wait);
});

// Teclado numérico para DNI; con pasaporte u otro documento pasa al teclado completo
$("[data-doc-toggle]").addEventListener("click", (e) => {
    const other = dniInput.inputMode === "numeric";
    dniInput.inputMode = other ? "text" : "numeric";
    dniInput.placeholder = other ? "Letras y números, sin espacios" : "Sin puntos ni espacios";
    $("[data-doc-label]").textContent = other ? "Pasaporte u otro documento" : "DNI";
    e.currentTarget.textContent = other ? "Tengo DNI" : "Tengo pasaporte u otro documento";
    dniInput.focus();
});

$("[data-verify]").addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) runVerify(dniInput.value);
});

// ---------- Nombre: sólo se pide (no se compara con el 360) ----------

const nameWords = () => nameInput.value.trim().split(/\s+/).filter(Boolean);

function setNameHint(state, text) {
    const hint = $("[data-hint='nombre']");
    hint.className = `field__hint ${state ? `field__hint--${state}` : ""}`;
    hint.textContent = text;
    $("[data-field='nombre']").classList.toggle("is-invalid", state === "error");
}

nameInput.addEventListener("input", () => setNameHint("", ""));

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
    if (!act) {
        $("[data-horario]").classList.add("is-invalid");
        $("[data-horario-msg]").textContent = "Elegí en qué horario querés hacer la actividad.";
        $("[data-horario]").scrollIntoView({ behavior: "smooth", block: "center" });
        $("[data-horario-select]").focus({ preventScroll: true });
        return formError("Elegí un horario.");
    }
    const r = verify.result;
    if (!r || verify.dni !== dniInput.value || verify.forId !== act.id) {
        if (dniInput.value.length < MIN_DOC) setVerify("error", "Escribí tu DNI o documento.");
        return formError(dniInput.value.length >= MIN_DOC ? "Esperá a que termine la verificación del documento." : "Revisá tu documento.");
    }
    if (!["ok", "sin_verificar", "no_cumple"].includes(r.status)) return formError("Revisá el mensaje del documento antes de enviar.");
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
    const priority = result.estado !== "En validación" && result.cumple === false
        ? " Como todavía no cumplís el requisito, tienen prioridad quienes sí lo cumplen."
        : "";
    $("[data-done-detail]").innerHTML = detail + priority;
    show("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Consultar estado ----------

$("[data-status-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("[data-status-result]");
    const dni = cleanDoc($("#status-dni").value);
    out.className = "status__result";
    out.textContent = "Buscando…";
    const r = await apiCall({ action: "estado", dni });
    if (r.status === "ok") {
        out.textContent = r.mensaje;
        out.classList.add(r.estado === "Confirmada" ? "is-ok" : "is-warn");
    } else if (r.status === "no_encontrado") {
        out.textContent = "No encontramos solicitudes con ese documento.";
        out.classList.add("is-warn");
    } else {
        out.textContent = r.status === "timeout"
            ? "Está tardando más de lo esperado. Probá de nuevo en un rato."
            : "No pudimos consultar ahora. Probá de nuevo en un rato.";
        out.classList.add("is-warn");
    }
});

init();
