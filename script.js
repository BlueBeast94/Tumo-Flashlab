// ==========================================================
// TUMO Barracas FlashLabs — cartelera (index.html)
// Las actividades vienen de la planilla (apiCall de config.js).
// ==========================================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);

const COLORS = ["blue", "red", "yellow", "dark"];
const STATE = {
    abierta: { label: "Inscripción abierta", cta: "Solicitar vacante" },
    espera:  { label: "Lista de espera", cta: "Anotarme en lista de espera" },
    cerrada: { label: "Inscripción cerrada", cta: "" },
};

// Versión corta del estado, arriba a la derecha de la imagen en cada tarjeta
const CARD_STATE = { abierta: "Disponible", espera: "En espera", cerrada: "Cerrada" };

let actividades = []; // una por actividad (los grupos A y B juntos, ver joinGroups)

// La planilla tiene una fila por grupo (musica-cine-a, musica-cine-b). En la cartelera va una tarjeta
// por actividad con los horarios de todos sus grupos; el horario se elige en el formulario.
function joinGroups(rows) {
    const byBase = new Map();
    rows.forEach((r) => {
        const base = baseId(r);
        if (!byBase.has(base)) byBase.set(base, []);
        byBase.get(base).push(r);
    });
    return [...byBase.entries()].map(([base, grupos]) => {
        grupos.sort((a, b) => String(a.grupo).localeCompare(String(b.grupo)));
        const estados = grupos.map((g) => g.estado);
        return {
            ...grupos[0],
            id: grupos.length > 1 ? base : grupos[0].id,
            grupos,
            horarios: grupos.map((g) => g.horario),
            // Disponible si algún grupo tiene vacantes; si no, en espera si alguno la tiene
            estado: estados.includes("abierta") ? "abierta" : estados.includes("espera") ? "espera" : "cerrada",
            libres: grupos.reduce((n, g) => n + (g.estado === "abierta" ? Number(g.libres) || 0 : 0), 0),
        };
    });
}

const signupUrl = (act) => `inscripcion.html?actividad=${encodeURIComponent(act.id)}`;

// Color y animación de cada actividad (los grupos A y B comparten). La clave es el ID sin "-a"/"-b".
//   color:  color de la tarjeta y del panel
//   art:    animación dibujada con código (ART, más abajo), si no hay imagen
//   imagen: GIF, foto o video propio (archivo en la carpeta img/). Tiene prioridad sobre "art".
//           La columna "Imagen" de la planilla, si está completa, le gana a esta.
//   zoom:   (opcional) agranda la imagen en la tarjeta, si el dibujo queda chico (1.5 = 50% más grande)
const LOOKS = {
    "musica-cine":      { color: "blue",   art: "notes" },
    "tumogotchi":       { color: "purple", art: "pet" },
    "animacion-gifs":   { color: "yellow", art: "yellow" },
    "juego-cartas":     { color: "dark",   art: "cards" },
    "carreras-iot":     { color: "green",  art: "red" },
    "sonido-codigo":    { color: "teal",   art: "blue" },
    "personajes-ia-3d": { color: "pink",   art: "character" },
    "tumo-tank":        { color: "red",    art: "dark", imagen: "img/Logomotion.gif", zoom: 1.5 },
};

// Una actividad nueva que no está en LOOKS toma un color por orden
function lookOf(act) {
    if (LOOKS[baseId(act)]) return LOOKS[baseId(act)];
    const names = [...new Set(actividades.map((a) => a.nombre))];
    const color = COLORS[names.indexOf(act.nombre) % COLORS.length];
    return { color, art: color };
}
const colorOf = (act) => lookOf(act).color;
const artOf = (act) => ART[lookOf(act).art];

// Encabezado de la tarjeta y del panel: imagen/GIF/video propio, o la animación de código
function mediaOf(act, lazy = false) {
    const src = act.imagen || lookOf(act).imagen;
    if (!src) return artOf(act);
    const url = escapeHtml(src);
    const zoom = !act.imagen && lookOf(act).zoom ? ` style="--zoom:${Number(lookOf(act).zoom)}"` : "";
    return /\.(mp4|webm)$/i.test(src)
        ? `<video src="${url}" autoplay muted loop playsinline${zoom}></video>`
        : `<img src="${url}" alt=""${lazy ? ' loading="lazy"' : ""}${zoom}>`;
}

// Animaciones del encabezado del panel, hasta que cada actividad tenga su imagen
const ART = {
    blue: `
        <div class="art-code">
            <div class="art-code__bar"><i></i><i></i><i></i></div>
            <span class="art-code__line" style="--w:70%;--d:0s"></span>
            <span class="art-code__line art-code__line--in" style="--w:55%;--d:.6s"></span>
            <span class="art-code__line art-code__line--in" style="--w:80%;--d:1.2s"></span>
            <span class="art-code__line" style="--w:35%;--d:1.8s"></span>
            <span class="art-code__cursor"></span>
        </div>`,
    red: `
        <div class="art-game">
            <span class="art-game__coin" style="--d:0s"></span>
            <span class="art-game__coin" style="--d:-1s"></span>
            <span class="art-game__hero"></span>
            <span class="art-game__block" style="--d:0s"></span>
            <span class="art-game__block" style="--d:-1.4s"></span>
            <span class="art-game__ground"></span>
        </div>`,
    yellow: `
        <div class="art-anim">
            <span class="art-anim__ghost" style="--x:-120px;--o:.15;--t:-.3s"></span>
            <span class="art-anim__ghost" style="--x:-80px;--o:.3;--t:-.2s"></span>
            <span class="art-anim__ghost" style="--x:-40px;--o:.5;--t:-.1s"></span>
            <span class="art-anim__ball"></span>
            <span class="art-anim__floor"></span>
        </div>`,
    dark: `
        <div class="art-robot">
            <span class="art-robot__gear art-robot__gear--big"></span>
            <span class="art-robot__gear art-robot__gear--small"></span>
            <div class="art-robot__head"><i></i><i></i></div>
        </div>`,

    // Creación de cartas: una carta que se da vuelta, dos que se abanican y un dado que rueda
    cards: `
        <div class="art-cards">
            <span class="art-cards__card art-cards__card--l"><i>K</i><b>♣</b></span>
            <span class="art-cards__card art-cards__card--r"><i>7</i><b>♦</b></span>
            <div class="art-cards__flip">
                <span class="art-cards__face art-cards__face--front"><i>A</i><b>♥</b></span>
                <span class="art-cards__face art-cards__face--back"></span>
            </div>
            <span class="art-cards__die"><i></i><i></i><i></i></span>
        </div>`,

    // Música para cine: notas que suben desde una cinta de película, sobre un pentagrama
    notes: `
        <div class="art-notes">
            <div class="art-notes__staff"><i></i><i></i><i></i><i></i><i></i></div>
            <span class="art-notes__note" style="--x:30px;--d:0s">♪</span>
            <span class="art-notes__note" style="--x:85px;--d:-0.8s">♫</span>
            <span class="art-notes__note" style="--x:140px;--d:-1.6s">♪</span>
            <span class="art-notes__note" style="--x:195px;--d:-2.4s">♬</span>
            <span class="art-notes__note" style="--x:240px;--d:-3.2s">♫</span>
            <div class="art-notes__film"></div>
        </div>`,

    // Personajes 3D: un personaje que gira sobre una base (el giro es una ilusión: la cara se desliza)
    character: `
        <div class="art-char">
            <span class="art-char__spark" style="--x:30px;--y:30px;--d:0s">✦</span>
            <span class="art-char__spark" style="--x:225px;--y:50px;--d:-0.7s">✦</span>
            <span class="art-char__spark" style="--x:205px;--y:10px;--d:-1.4s">✦</span>
            <div class="art-char__table"><span></span></div>
            <div class="art-char__fig">
                <span class="art-char__head"><span class="art-char__face"><i></i><i></i><u></u></span></span>
                <span class="art-char__body"><span class="art-char__badge"></span></span>
            </div>
        </div>`,

    // TumoGotchi: el aparatito con su mascota de píxeles, un corazón y los botones
    pet: `
        <div class="art-pet">
            <div class="art-pet__egg">
                <div class="art-pet__screen">
                    <span class="art-pet__heart">♥</span>
                    <span class="art-pet__pet"><i></i><i></i></span>
                    <span class="art-pet__floor"></span>
                </div>
                <div class="art-pet__btns"><i></i><i></i><i></i></div>
            </div>
        </div>`,
};

// ---------- Cartelera ----------

function stateBadge(estado) {
    return `<span class="state state--${estado}">${STATE[estado].label}</span>`;
}

function signupButton(act, extraClass = "") {
    if (act.estado === "cerrada") {
        return `<span class="btn card__signup is-disabled ${extraClass}" aria-disabled="true">Inscripción cerrada</span>`;
    }
    return `<a class="btn card__signup ${extraClass}" href="${signupUrl(act)}">${STATE[act.estado].cta}</a>`;
}

function renderCards() {
    const wrap = $("[data-lab-cards]");
    wrap.removeAttribute("aria-busy");
    // Tarjeta: imagen (o animación), nombre, horario + estado, días y botón.
    // Toda la tarjeta abre el detalle; el botón "Solicitar vacante" va directo al formulario.
    wrap.innerHTML = actividades.map((act) => `
        <article class="card card--${colorOf(act)} ${act.estado === "cerrada" ? "is-closed" : ""}">
            <div class="card__media">
                ${mediaOf(act, true)}
                <span class="card__badge state state--${act.estado}">${CARD_STATE[act.estado]}</span>
            </div>
            <h3>
                <button class="card__open" data-open-lab="${escapeHtml(act.id)}" aria-haspopup="dialog">${escapeHtml(act.nombre)}</button>
            </h3>
            <!-- Grupo oculto para las familias: <span class="card__type">Grupo ${escapeHtml(act.grupo)}</span> -->
            ${scheduleHtml(act, "sm")}
            ${signupButton(act)}
        </article>`).join("");
    /* Tarjeta anterior (por si se quiere volver):
        <div class="card__top">
            <span class="card__type">${tipo} · Grupo ${grupo}</span>
            ${stateBadge(act.estado)}
        </div>
        <h3><button class="card__open" …>${nombre}</button></h3>
        <p class="card__desc">${descripcion}</p>
        ${scheduleHtml(act, "sm")}
        <p class="card__meta"><span>${capacidad} vacantes</span><span>Requisito: …</span></p>
        <span class="card__more" aria-hidden="true">Ver detalle +</span>
        ${signupButton(act)}
    */

    // Un clic en cualquier parte de la tarjeta abre el detalle, salvo en el botón de inscripción.
    // (Con teclado, el nombre es un botón.)
    $$(".card", wrap).forEach((card) => {
        const id = $("[data-open-lab]", card).dataset.openLab;
        card.addEventListener("click", (e) => {
            if (!e.target.closest(".card__signup")) openPanel(id);
        });
    });
}

function renderSkeleton() {
    const wrap = $("[data-lab-cards]");
    wrap.setAttribute("aria-busy", "true");
    wrap.innerHTML = Array.from({ length: 4 }, () => '<div class="card card--skeleton" aria-hidden="true"></div>').join("");
    $("[data-cartelera-msg]").hidden = true;
}

function renderError(status) {
    const text = {
        timeout: "La cartelera está tardando más de lo esperado.",
        no_configurado: "La cartelera todavía no está conectada.",
        demasiados_intentos: "Hubo demasiados intentos seguidos. Esperá un minuto.",
    }[status] || "No pudimos cargar la cartelera.";
    $("[data-lab-cards]").innerHTML = "";
    const msg = $("[data-cartelera-msg]");
    msg.hidden = false;
    msg.innerHTML = `<p>${text} Actualizá para probar de nuevo.</p>
        <button type="button" class="btn btn--blue" data-retry>Reintentar</button>`;
    $("[data-retry]", msg).addEventListener("click", loadCartelera);
}

async function loadCartelera() {
    renderSkeleton();
    const data = await apiCall({ action: "actividades" });
    if (data.status !== "ok") return renderError(data.status);
    window.FLASHLAB_ACTIVIDADES = data.actividades || []; // el chatbot las usa para armar links (una por grupo)
    actividades = joinGroups(data.actividades || []);
    if (!actividades.length) {
        $("[data-lab-cards]").innerHTML = "";
        const msg = $("[data-cartelera-msg]");
        msg.hidden = false;
        msg.innerHTML = "<p>Todavía no hay actividades publicadas.</p>";
        return;
    }
    renderCards();
}

// ---------- Panel de detalle ----------

function openPanel(id) {
    const act = actividades.find((a) => a.id === id);
    if (!act) return;
    const panel = $("[data-lab-panel]");
    const color = colorOf(act);

    panel.className = `lab-panel lab-panel--${color}`;
    $("[data-lab-media]").innerHTML = mediaOf(act);
    $("[data-lab-kicker]").textContent = act.tipo; // sin el grupo: `${act.tipo} · Grupo ${act.grupo}`
    $("[data-lab-title]").textContent = act.nombre;
    const pocas = act.estado === "abierta" && act.libres > 0 && act.libres <= 5;
    $("[data-lab-state]").innerHTML = stateBadge(act.estado) +
        (pocas ? ` <span class="lab-panel__few">¡Quedan pocas vacantes!</span>` : "");
    $("[data-lab-intro]").textContent = act.descripcion || "Pronto vamos a publicar la descripción completa de esta actividad.";
    $("[data-lab-sched]").innerHTML = scheduleHtml(act, "md");
    $("[data-lab-capacidad]").textContent = act.grupos.length > 1 ? `${act.capacidad} vacantes por horario` : `${act.capacidad} vacantes`;
    $("[data-lab-requisito]").innerHTML = requisitoHtml(act);
    $("[data-lab-herramientas]").textContent = act.herramientas || "";
    $("[data-lab-tools-box]").hidden = !act.herramientas;

    const cta = $("[data-lab-signup]");
    cta.hidden = act.estado === "cerrada";
    cta.href = signupUrl(act);
    cta.textContent = STATE[act.estado].cta;

    panel.showModal();
}

function initPanel() {
    const panel = $("[data-lab-panel]");
    $("[data-lab-close]").addEventListener("click", () => panel.close());
    panel.addEventListener("click", (e) => {
        if (e.target === panel) panel.close();
    });
}

// ---------- Consultar el estado de una solicitud (en las preguntas frecuentes) ----------

function initStatus() {
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

    // Los links a #estado (botón "Consultar mi solicitud", mensajes del formulario) abren la pregunta
    const openStatus = () => {
        if (location.hash !== "#estado") return;
        $("#estado").open = true;
        $("#status-dni").focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", openStatus);
    // Si ya estaba en #estado, el click no cambia el hash: se abre igual
    $$('a[href="#estado"]').forEach((a) => a.addEventListener("click", () => setTimeout(openStatus)));
    openStatus();
}

initPanel();
initStatus();
loadCartelera();
