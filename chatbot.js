// ==========================================================
// TUMO Flash Lab — chatbot "Flashy" (botón flotante + panel)
// Habla con /api/chat (Vercel), que llama a Groq.
// ==========================================================

(() => {
    const API = "/api/chat";
    const GREETING = "¡Hola! Soy Flashy 🤖 el asistente del Flash Lab. Preguntame lo que quieras sobre las actividades, los horarios o la inscripción.";
    const SUGGESTIONS = ["¿Cuándo y dónde es?", "¿Tiene costo?", "¿Qué labs hay?", "¿Cómo me inscribo?"];
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

    // Markdown mínimo: **negrita**, listas con "-" y saltos de línea
    function format(text) {
        return escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
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

    async function ask(question) {
        question = question.trim();
        if (!question) return;

        $("[data-chat-chips]").hidden = true;
        addMessage("user", question);
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
                reply = data.reply;
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

    function setOpen(open) {
        panel.hidden = !open;
        root.classList.toggle("is-open", open);
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
    $("[data-chat-dismiss]").addEventListener("click", hideBubble);
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
