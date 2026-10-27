// Permite usar la API publicada desde una copia local de la web (Live Server de VS Code, etc.).
// Sólo se aceptan orígenes localhost / 127.0.0.1 y archivos abiertos con doble clic (el navegador
// manda Origin "null"); el sitio publicado no lo necesita (mismo origen).

const LOCAL_ORIGIN = /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?|null)$/;

// Devuelve true si ya respondió (pedido OPTIONS previo de CORS).
function handleCors(req, res) {
    const origin = req.headers.origin;
    if (origin && LOCAL_ORIGIN.test(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return true;
    }
    return false;
}

module.exports = { handleCors };
