// ==========================================================
// TUMO Flash Lab — lógica de la página
// ==========================================================

const CONFIG = {
    // Link al Google Form de inscripción
    FORM_URL: "",
    // URL del Web App de Google Apps Script (devuelve los confirmados y el estado por mail).
    // Mientras esté vacío, la página muestra datos de ejemplo.
    API_URL: "",
    CAPACITY: 20,
};

// Datos de ejemplo hasta conectar la planilla
const DEMO = {
    confirmed: ["Martina G.", "Tomás R.", "Lucía P.", "Benjamín S.", "Sofía L.",
                "Joaquín M.", "Valentina D.", "Mateo F.", "Camila A.", "Thiago B.",
                "Emma C.", "Santino V."],
};

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function setStat(name, value) {
    $$(`[data-stat="${name}"]`).forEach((el) => { el.textContent = value; });
}

function renderBoard(names) {
    const list = $("[data-list]");
    const capacity = CONFIG.CAPACITY;
    const taken = Math.min(names.length, capacity);

    list.innerHTML = "";
    for (let i = 0; i < capacity; i++) {
        const li = document.createElement("li");
        const label = document.createElement("span");
        if (i < taken) {
            label.textContent = names[i];
            li.classList.add("is-new");
            li.style.animationDelay = `${i * 40}ms`;
        } else {
            label.textContent = "Lugar disponible";
            li.classList.add("is-empty");
        }
        li.appendChild(label);
        list.appendChild(li);
    }

    setStat("capacity", capacity);
    setStat("confirmed", taken);
    setStat("left", capacity - taken);
    $("[data-progress]").setAttribute("aria-valuenow", taken);
    $("[data-progress-bar]").style.width = `${(taken / capacity) * 100}%`;
}

async function loadBoard() {
    if (!CONFIG.API_URL) {
        $("[data-demo-flag]").hidden = false;
        renderBoard(DEMO.confirmed);
        return;
    }
    try {
        const res = await fetch(`${CONFIG.API_URL}?action=board`);
        const data = await res.json();
        renderBoard(data.confirmed || []);
    } catch (err) {
        console.error("No se pudo cargar la lista de confirmados", err);
        renderBoard([]);
    }
}

const STATUS_TEXT = {
    registered: ["Recibimos tu inscripción. Revisá tu mail para confirmar.", "is-warn"],
    confirmed:  ["¡Confirmaste! Estás dentro de los primeros 20.", "is-ok"],
    waitlist:   ["Confirmaste, pero estás en lista de espera. Te avisamos si se libera un lugar.", "is-warn"],
    expired:    ["Tu lugar se liberó porque no confirmaste a tiempo.", "is-warn"],
    not_found:  ["No encontramos ese mail. ¿Ya completaste el formulario?", "is-warn"],
};

async function checkStatus(email) {
    if (!CONFIG.API_URL) return "not_found";
    const res = await fetch(`${CONFIG.API_URL}?action=status&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.status || "not_found";
}

function initStatusForm() {
    const form = $("[data-status-form]");
    const out = $("[data-status-result]");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = form.querySelector("input").value.trim().toLowerCase();
        out.className = "status__result";
        out.textContent = "Buscando…";
        try {
            const [text, cls] = STATUS_TEXT[await checkStatus(email)] || STATUS_TEXT.not_found;
            out.textContent = CONFIG.API_URL ? text : "Modo demo: todavía no está conectada la planilla.";
            out.classList.add(cls);
        } catch (err) {
            out.textContent = "Hubo un problema al consultar. Probá de nuevo en un rato.";
            out.classList.add("is-warn");
        }
    });
}

function initFormLink() {
    const link = $("[data-form-link]");
    if (CONFIG.FORM_URL) {
        link.href = CONFIG.FORM_URL;
    } else {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            alert("El formulario todavía no está publicado.");
        });
    }
}

loadBoard();
initStatusForm();
initFormLink();
