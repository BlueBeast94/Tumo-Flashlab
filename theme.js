// ==========================================================
// TUMO Barracas FlashLabs — cambio de colores (fondo blanco ↔ fondo rojo TUMO)
// Se carga en el <head> para aplicar el tema antes de pintar la página (sin parpadeo).
// El botón redondo de arriba (data-theme-toggle) alterna; la elección se recuerda en este navegador.
// Los estilos del tema rojo están en style.css, sección "Tema rojo".
// ==========================================================

(() => {
    const KEY = "flashlab-theme";
    const root = document.documentElement;
    const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
    const save = (v) => { try { localStorage.setItem(KEY, v); } catch { /* sin storage: dura hasta recargar */ } };

    const apply = (theme) => {
        if (theme === "red") root.dataset.theme = "red";
        else delete root.dataset.theme;
    };
    apply(read());

    // Animación del cambio: el color nuevo crece en círculo desde el botón, con un anillo
    // de colores TUMO girando en el borde. Usa View Transitions (Chrome, Edge, Safari 18+, Firefox 144+);
    // en navegadores sin soporte o con "reducir movimiento" el cambio es directo.
    const DURATION = 900;
    const EASE = "cubic-bezier(.65, 0, .25, 1)";

    function switchWithCircle(btn, change) {
        const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!document.startViewTransition || reduce) return change();

        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

        btn.classList.remove("is-spinning");
        void btn.offsetWidth; // reinicia el giro del botón si se toca dos veces seguidas
        btn.classList.add("is-spinning");

        // Anillo de colores: va dentro de la página nueva, así se ve justo en el borde del círculo
        const ring = document.createElement("div");
        ring.className = "theme-ring";
        ring.style.cssText = `left:${x}px; top:${y}px; width:${end * 2}px; height:${end * 2}px;`;
        document.body.appendChild(ring);

        const t = document.startViewTransition(change);
        t.ready.then(() => {
            root.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
                { duration: DURATION, easing: EASE, pseudoElement: "::view-transition-new(root)" },
            );
            ring.animate(
                [
                    { transform: "translate(-50%, -50%) scale(0) rotate(0deg)", opacity: 1 },
                    { transform: "translate(-50%, -50%) scale(1) rotate(300deg)", opacity: 1, offset: 0.85 },
                    { transform: "translate(-50%, -50%) scale(1.04) rotate(360deg)", opacity: 0 },
                ],
                { duration: DURATION, easing: EASE, fill: "forwards" },
            );
        }).catch(() => {});
        t.finished.finally(() => ring.remove());
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
            const sync = () => {
                const red = root.dataset.theme === "red";
                btn.setAttribute("aria-pressed", String(red));
                btn.setAttribute("aria-label", red ? "Cambiar a fondo blanco" : "Cambiar a fondo rojo");
                btn.title = btn.getAttribute("aria-label");
            };
            sync();
            btn.addEventListener("click", () => {
                const next = root.dataset.theme === "red" ? "light" : "red";
                switchWithCircle(btn, () => {
                    apply(next);
                    save(next);
                    sync();
                });
            });
        });
    });
})();
