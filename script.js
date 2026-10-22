// ==========================================================
// TUMO Flash Lab — landing (index.html)
// Usa LABS, TURNOS y CONFIG de config.js
// ==========================================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);

const signupUrl = (lab) => `inscripcion.html?lab=${encodeURIComponent(lab.id)}`;

// Animaciones del encabezado del panel (se reemplazan por lab.media cuando haya GIF/video)
const LAB_ART = {
    programacion: `
        <div class="art-code">
            <div class="art-code__bar"><i></i><i></i><i></i></div>
            <span class="art-code__line" style="--w:70%;--d:0s"></span>
            <span class="art-code__line art-code__line--in" style="--w:55%;--d:.6s"></span>
            <span class="art-code__line art-code__line--in" style="--w:80%;--d:1.2s"></span>
            <span class="art-code__line" style="--w:35%;--d:1.8s"></span>
            <span class="art-code__cursor"></span>
        </div>`,
    videojuegos: `
        <div class="art-game">
            <span class="art-game__coin" style="--d:0s"></span>
            <span class="art-game__coin" style="--d:-1s"></span>
            <span class="art-game__hero"></span>
            <span class="art-game__block" style="--d:0s"></span>
            <span class="art-game__block" style="--d:-1.4s"></span>
            <span class="art-game__ground"></span>
        </div>`,
    animacion: `
        <div class="art-anim">
            <span class="art-anim__ghost" style="--x:-120px;--o:.15;--t:-.3s"></span>
            <span class="art-anim__ghost" style="--x:-80px;--o:.3;--t:-.2s"></span>
            <span class="art-anim__ghost" style="--x:-40px;--o:.5;--t:-.1s"></span>
            <span class="art-anim__ball"></span>
            <span class="art-anim__floor"></span>
        </div>`,
    robotica: `
        <div class="art-robot">
            <span class="art-robot__gear art-robot__gear--big"></span>
            <span class="art-robot__gear art-robot__gear--small"></span>
            <div class="art-robot__head"><i></i><i></i></div>
        </div>`,
};

function renderCards() {
    const wrap = $("[data-lab-cards]");
    wrap.innerHTML = LABS.map((lab) => `
        <article class="card card--${lab.color}">
            <span class="card__icon">${lab.icon}</span>
            <h3>
                <button class="card__open" data-open-lab="${lab.id}" aria-haspopup="dialog">${lab.name}</button>
            </h3>
            <p>${lab.short}</p>
            <div class="card__foot">
                <span class="card__time">${lab.turnos.join(" · ")}</span>
                <span class="card__more" aria-hidden="true">Ver más +</span>
            </div>
            <a class="btn card__signup" href="${signupUrl(lab)}">Inscribirme</a>
        </article>`).join("");

    $$("[data-open-lab]", wrap).forEach((btn) => {
        btn.addEventListener("click", () => openPanel(btn.dataset.openLab));
    });
}

function openPanel(id) {
    const lab = findLab(id);
    const panel = $("[data-lab-panel]");

    panel.className = `lab-panel lab-panel--${lab.color}`;
    $("[data-lab-media]").innerHTML = lab.media
        ? (/\.(mp4|webm)$/i.test(lab.media)
            ? `<video src="${lab.media}" autoplay muted loop playsinline></video>`
            : `<img src="${lab.media}" alt="">`)
        : LAB_ART[lab.id] || "";
    $("[data-lab-title]").textContent = lab.name;
    $("[data-lab-intro]").textContent = lab.intro;
    $("[data-lab-list]").innerHTML = lab.youWill.map((item) => `<li>${item}</li>`).join("");
    $("[data-lab-turnos]").innerHTML = lab.turnos
        .map((t) => `${t} · ${TURNOS[t].time}`).join("<br>");
    $("[data-lab-take]").textContent = lab.takeHome;
    $("[data-lab-signup]").href = signupUrl(lab);
    $("[data-lab-signup]").textContent = `Inscribirme a ${lab.name}`;

    panel.showModal();
}

function initPanel() {
    const panel = $("[data-lab-panel]");
    $("[data-lab-close]").addEventListener("click", () => panel.close());
    // Cerrar tocando fuera del panel
    panel.addEventListener("click", (e) => {
        if (e.target === panel) panel.close();
    });
}

$$('[data-stat="capacity"]').forEach((el) => { el.textContent = CONFIG.CAPACITY; });
renderCards();
initPanel();
