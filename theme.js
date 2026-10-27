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
                apply(next);
                save(next);
                sync();
            });
        });
    });
})();
