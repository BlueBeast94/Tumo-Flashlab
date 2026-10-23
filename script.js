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

let actividades = [];

const signupUrl = (act) => `inscripcion.html?actividad=${encodeURIComponent(act.id)}`;
const requisitoText = (act) => act.requisito ? act.requisito : "Sin requisitos previos";

// El mismo color para los grupos A y B de una actividad
function colorOf(act) {
    const names = [...new Set(actividades.map((a) => a.nombre))];
    return COLORS[names.indexOf(act.nombre) % COLORS.length];
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
    wrap.innerHTML = actividades.map((act) => `
        <article class="card card--${colorOf(act)} ${act.estado === "cerrada" ? "is-closed" : ""}">
            <div class="card__top">
                <span class="card__type">${escapeHtml(act.tipo)} · Grupo ${escapeHtml(act.grupo)}</span>
                ${stateBadge(act.estado)}
            </div>
            <h3>
                <button class="card__open" data-open-lab="${escapeHtml(act.id)}" aria-haspopup="dialog">${escapeHtml(act.nombre)}</button>
            </h3>
            <p class="card__desc">${escapeHtml(act.descripcion || "Tocá para ver el detalle de la actividad.")}</p>
            <ul class="card__facts">
                <li><strong>Horario</strong> ${escapeHtml(act.horario)}</li>
                <li><strong>Capacidad</strong> ${act.capacidad} vacantes</li>
                <li><strong>Requisitos</strong> ${escapeHtml(requisitoText(act))}</li>
            </ul>
            <span class="card__more" aria-hidden="true">Ver detalle +</span>
            ${signupButton(act)}
        </article>`).join("");

    $$("[data-open-lab]", wrap).forEach((btn) => {
        btn.addEventListener("click", () => openPanel(btn.dataset.openLab));
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
    actividades = data.actividades || [];
    window.FLASHLAB_ACTIVIDADES = actividades; // el chatbot las usa para armar links
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
    $("[data-lab-media]").innerHTML = act.imagen
        ? `<img src="${escapeHtml(act.imagen)}" alt="">`
        : ART[color];
    $("[data-lab-kicker]").textContent = `${act.tipo} · Grupo ${act.grupo}`;
    $("[data-lab-title]").textContent = act.nombre;
    const pocas = act.estado === "abierta" && act.libres > 0 && act.libres <= 5;
    $("[data-lab-state]").innerHTML = stateBadge(act.estado) +
        (pocas ? ` <span class="lab-panel__few">¡Quedan pocas vacantes!</span>` : "");
    $("[data-lab-intro]").textContent = act.descripcion || "Pronto vamos a publicar la descripción completa de esta actividad.";
    $("[data-lab-dias]").textContent = act.dias;
    $("[data-lab-horario]").textContent = act.horario;
    $("[data-lab-capacidad]").textContent = `${act.capacidad} vacantes`;
    $("[data-lab-requisito]").textContent = requisitoText(act);

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

initPanel();
loadCartelera();
