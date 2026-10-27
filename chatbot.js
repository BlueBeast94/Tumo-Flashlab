// ==========================================================
// TUMO Flash Lab — chatbot "Flashy" (botón flotante + panel)
// Habla con /api/chat (Vercel), que llama a Groq.
// ==========================================================

(() => {
    const API = `${API_BASE}/api/chat`; // API_BASE viene de config.js
    const GREETING = "¡Hola! Soy Flashy 🤖 el asistente del Flash Lab. Preguntame lo que quieras sobre las actividades, los horarios o la inscripción.";
    const SUGGESTIONS = ["¿Cuándo y dónde es?", "¿Qué labs hay?", "¿Cómo me inscribo?", "¿Cuál es el estado de mi solicitud?"];
    const ERRORS = {
        missing_key: "Todavía no estoy conectado 😅 (falta configurar la API key de Groq).",
        busy: "Estoy recibiendo muchas preguntas. Probá de nuevo en un minuto.",
        default: "Uy, no pude responder ahora. Probá de nuevo en un rato.",
    };

    const history = [];
    const storage = {
        get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* sin storage */ } },
    };

    const botFace = (cls) => `
        <span class="bot ${cls}" aria-hidden="true">
            <span class="bot__antenna"></span>
            <span class="bot__head">
                <span class="bot__eyes"><i></i><i></i></span>
                <span class="bot__mouth"></span>
            </span>
        </span>`;

    // ---------- DOM ----------

    const root = document.createElement("div");
    root.className = "chat";
    root.innerHTML = `
        <div class="chat__backdrop" data-chat-backdrop></div>

        <div class="chat__bubble" data-chat-bubble hidden>
            <button class="chat__bubble-close" data-chat-dismiss aria-label="Cerrar mensaje">✕</button>
            <strong>¿Tenés dudas?</strong>
            <span>¡Preguntame! Te ayudo con todo sobre el Flash Lab.</span>
        </div>

        <section class="chat__panel" data-chat-panel role="dialog" aria-label="Chat con Flashy" hidden>
            <header class="chat__head">
                ${botFace("bot--sm")}
                <div>
                    <strong>Flashy</strong>
                    <span>Asistente del Flash Lab</span>
                </div>
                <button class="chat__close" data-chat-close aria-label="Cerrar chat">✕</button>
            </header>
            <div class="chat__log" data-chat-log aria-live="polite"></div>
            <div class="chat__chips" data-chat-chips>
                ${SUGGESTIONS.map((q) => `<button type="button" class="chat__chip">${q}</button>`).join("")}
            </div>
            <form class="chat__form" data-chat-form>
                <label class="sr-only" for="chat-input">Tu pregunta</label>
                <input id="chat-input" maxlength="500" autocomplete="off" placeholder="Escribí tu pregunta…">
                <button type="submit" aria-label="Enviar">➤</button>
            </form>
            <p class="chat__disclaimer">Respuestas generadas con IA. Ante cualquier duda, consultá con el equipo de TUMO.</p>
        </section>

        <button class="chat__fab" data-chat-toggle aria-label="Abrir chat de ayuda" aria-expanded="false">
            ${botFace("bot--lg")}
        </button>`;
    document.body.appendChild(root);

    const $ = (sel) => root.querySelector(sel);
    const panel = $("[data-chat-panel]");
    const bubble = $("[data-chat-bubble]");
    const log = $("[data-chat-log]");
    const form = $("[data-chat-form]");
    const input = $("#chat-input");
    const toggle = $("[data-chat-toggle]");

    // ---------- Mensajes ----------

    const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // Markdown mínimo: **negrita**, [links](/inscripcion.html), listas con "-" y saltos de línea.
    // Sólo se convierten en link las páginas del propio sitio.
    function format(text) {
        return escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\[([^\]]+)\]\(\/?((?:inscripcion|index)\.html[^)\s]*)\)/g, '<a class="chat__link" href="/$2">$1</a>')
            .split(/\n+/)
            .map((line) => /^\s*[-*•]\s+/.test(line) ? `<li>${line.replace(/^\s*[-*•]\s+/, "")}</li>` : `<p>${line}</p>`)
            .join("")
            .replace(/(<li>.*?<\/li>)+/g, (list) => `<ul>${list}</ul>`);
    }

    function addMessage(role, text) {
        const msg = document.createElement("div");
        msg.className = `chat__msg chat__msg--${role}`;
        msg.innerHTML = role === "bot" ? format(text) : `<p>${escapeHtml(text)}</p>`;
        log.appendChild(msg);
        log.scrollTop = log.scrollHeight;
        return msg;
    }

    function showTyping() {
        const typing = document.createElement("div");
        typing.className = "chat__msg chat__msg--bot chat__typing";
        typing.innerHTML = "<i></i><i></i><i></i>";
        log.appendChild(typing);
        log.scrollTop = log.scrollHeight;
        return typing;
    }

    // Si la pregunta es para inscribirse y la respuesta no trae el link, lo agregamos
    const SIGNUP_INTENT = /inscrib|anot(o|ar|arme)|registr|formulario|quiero (ir|participar|sumarme)/i;

    const plain = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // Si la pregunta nombra una actividad de la cartelera (cargada en index.html), link directo a su formulario
    function signupLink(question) {
        const q = plain(question);
        const grupo = (q.match(/grupo ([ab])\b/) || [])[1];
        const list = (window.FLASHLAB_ACTIVIDADES || []).filter((a) => a.estado !== "cerrada" && q.includes(plain(a.nombre)));
        const act = list.find((a) => plain(a.grupo) === grupo) || list[0];
        return act
            ? `¡Perfecto! Podés inscribirte [acá](/inscripcion.html?actividad=${act.id})`
            : "¡Perfecto! Elegí tu actividad en la [cartelera](/index.html#actividades)";
    }

    function withSignupLink(question, reply) {
        if (!SIGNUP_INTENT.test(question) || /\]\(\/?(inscripcion|index)\.html/.test(reply)) return reply;
        return `${reply}\n${signupLink(question)}`;
    }

    // ---------- Estado de la solicitud ----------
    // Se responde acá mismo con la planilla (como en las preguntas frecuentes). El documento NO va a la IA:
    // ni la pregunta ni la respuesta se guardan en `history`.
    const STATUS_INTENT = /estado de mi|mi solicitud|mi inscripci[oó]n|ya me (confirmaron|anot|inscrib)|me confirmaron|en qu[eé] (estado|qued)|tengo (la )?vacante|qued[eé] (anotad|inscript|en lista)/i;
    let awaitingDoc = false;

    // "40.123.456", "40 123 456" o "AA123456" → documento limpio; null si no hay uno en el texto
    function docIn(text) {
        const joined = text.replace(/(\d)[.\s-](?=\d)/g, "$1").toUpperCase();
        const m = joined.match(/\b(?=[A-Z0-9]*\d)[A-Z0-9]{6,12}\b/);
        return m ? cleanDoc(m[0]) : null; // cleanDoc viene de config.js
    }

    async function statusReply(doc) {
        const r = await apiCall({ action: "estado", dni: doc });
        if (r.status === "ok") return `Encontré tu solicitud: **${r.mensaje}**.`;
        if (r.status === "no_encontrado") {
            return "No encontré solicitudes con ese documento. Revisá que esté bien escrito (sin puntos). " +
                "Si todavía no te anotaste, elegí tu actividad en la [cartelera](/index.html#actividades).";
        }
        return r.status === "timeout"
            ? "La consulta está tardando más de lo esperado. Probá de nuevo en un rato."
            : "No pude consultar ahora. Probá de nuevo en un rato.";
    }

    // Devuelve true si la pregunta era sobre el estado (y ya se respondió)
    async function handleStatus(question) {
        const doc = docIn(question);
        const wantsStatus = STATUS_INTENT.test(question);
        if (doc && (awaitingDoc || wantsStatus)) {
            awaitingDoc = false;
            const typing = showTyping();
            const reply = await statusReply(doc);
            typing.remove();
            addMessage("bot", reply);
            return true;
        }
        if (wantsStatus) {
            awaitingDoc = true;
            addMessage("bot", "¡Te ayudo! Escribime tu **DNI** (o el documento que usaste para anotarte), sin puntos ni espacios.");
            return true;
        }
        awaitingDoc = false; // cambió de tema
        return false;
    }

    async function ask(question) {
        question = question.trim();
        if (!question) return;

        $("[data-chat-chips]").hidden = true;
        addMessage("user", question);

        input.value = "";
        form.classList.add("is-busy");
        const handled = await handleStatus(question);
        form.classList.remove("is-busy");
        if (handled) {
            input.focus();
            return;
        }
        history.push({ role: "user", content: question });
        input.value = "";
        form.classList.add("is-busy");
        root.classList.add("is-thinking");
        const typing = showTyping();

        let reply;
        try {
            const res = await fetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: history }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.reply) {
                reply = withSignupLink(question, data.reply);
                history.push({ role: "assistant", content: reply });
            } else {
                reply = ERRORS[data.error] || ERRORS.default;
                history.pop(); // no guardar la pregunta que falló
            }
        } catch {
            reply = ERRORS.default;
            history.pop();
        }

        typing.remove();
        addMessage("bot", reply);
        form.classList.remove("is-busy");
        root.classList.remove("is-thinking");
        input.focus();
    }

    // ---------- Abrir / cerrar ----------

    // En el celular el teclado achica la pantalla visible: el panel se ajusta a ese espacio
    // (visualViewport) en vez de quedar tapado o empujado hacia arriba.
    function syncViewport() {
        const vv = window.visualViewport;
        if (!vv) return;
        root.style.setProperty("--vv-height", `${vv.height}px`);
        root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
        log.scrollTop = log.scrollHeight;
    }
    if (window.visualViewport) {
        visualViewport.addEventListener("resize", () => { if (!panel.hidden) syncViewport(); });
        visualViewport.addEventListener("scroll", () => { if (!panel.hidden) syncViewport(); });
    }

    function setOpen(open) {
        panel.hidden = !open;
        root.classList.toggle("is-open", open);
        document.documentElement.classList.toggle("chat-open", open);
        if (open) syncViewport();
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Cerrar chat de ayuda" : "Abrir chat de ayuda");
        if (open) {
            hideBubble();
            if (!log.children.length) addMessage("bot", GREETING);
            input.focus();
        }
    }

    function hideBubble() {
        bubble.hidden = true;
        storage.set("flashy-bubble", "seen");
    }

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    $("[data-chat-close]").addEventListener("click", () => { setOpen(false); toggle.focus(); });
    $("[data-chat-backdrop]").addEventListener("click", () => setOpen(false));
    $("[data-chat-dismiss]").addEventListener("click", hideBubble);
    // Un link del chat (cartelera, preguntas frecuentes, formulario) cierra el chat para que se vea a dónde lleva
    log.addEventListener("click", (e) => {
        const link = e.target.closest(".chat__link");
        if (!link) return;
        setOpen(false);
        // Misma página (ej. /index.html#actividades): se baja a la sección recién con el chat cerrado,
        // porque mientras está abierto la página no se puede mover
        const url = new URL(link.href, location.href);
        const target = url.hash && url.pathname.replace(/\/$/, "/index.html") === location.pathname.replace(/\/$/, "/index.html")
            ? document.querySelector(url.hash) : null;
        if (!target) return;
        e.preventDefault();
        window.history.pushState(null, "", url.hash); // (`history` acá adentro es la charla)
        window.dispatchEvent(new HashChangeEvent("hashchange")); // abre "¿Cuál es el estado…?" si el link es #estado
        setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    });
    bubble.addEventListener("click", (e) => { if (!e.target.closest("[data-chat-dismiss]")) setOpen(true); });
    $("[data-chat-chips]").addEventListener("click", (e) => {
        if (e.target.matches(".chat__chip")) ask(e.target.textContent);
    });
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.classList.contains("is-busy")) ask(input.value);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !panel.hidden) setOpen(false);
    });

    // El globito aparece a los 2 s, una vez por sesión
    if (!storage.get("flashy-bubble")) {
        setTimeout(() => { if (panel.hidden) bubble.hidden = false; }, 2000);
    }
})();
