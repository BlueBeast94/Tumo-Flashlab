// ==========================================================
// TUMO Flash Lab — configuración y datos compartidos
// Lo usan index.html e inscripcion.html
// ==========================================================

const CONFIG = {
    // URL del Web App de Google Apps Script (recibe inscripciones y responde el estado).
    // Mientras esté vacío, las páginas funcionan en modo demo.
    API_URL: "",
    CAPACITY: 20, // lugares por lab y por turno
};

// Datos del evento. El chatbot responde sólo con esta información (y LABS / TURNOS).
const EVENT = {
    name: "TUMO Flash Lab",
    date: "sábado 13 de diciembre de 2026",
    place: "TUMO Buenos Aires (dirección a confirmar)",
    ages: "12 a 18 años",
    price: "Gratis",
    bring: "Ganas de crear. Si es menor, la autorización firmada por su adulto responsable.",
    rules: [
        "Hay 20 lugares por cada lab y por cada turno.",
        "Cada participante (identificado por su DNI) puede inscribirse a una sola actividad.",
        "Después de inscribirse llega un mail al estudiante y al responsable con un link para confirmar.",
        "Hay 48 horas para confirmar; a las 24 horas se envía un recordatorio. Si no se confirma, el lugar se libera.",
        "Los primeros 20 que confirman en cada lab y turno tienen el lugar asegurado; el resto queda en lista de espera.",
        "Si alguien se da de baja, el primero de la lista de espera sube automáticamente y recibe un mail.",
        "Dos días antes y el mismo día del evento se envía un recordatorio con el lugar y horario.",
        "No hace falta experiencia previa y todo el material lo pone TUMO.",
        "La inscripción se hace en la página inscripcion.html del sitio; el estado se consulta ahí mismo con el DNI.",
    ],
    contact: "",  // mail de contacto para derivar preguntas que el bot no sepa responder
};

const TURNOS = {
    TM: { name: "Turno mañana", time: "10:00 – 13:00" },
    TT: { name: "Turno tarde",  time: "14:00 – 17:00" },
};

// Flash Labs disponibles. Para sumar uno, agregá un objeto acá.
// "media" acepta la ruta a un GIF/video; si está vacío se usa la animación de la tarjeta.
const LABS = [
    {
        id: "programacion",
        name: "Programación",
        color: "blue",
        icon: "&lt;/&gt;", // se inserta como HTML
        short: "Escribí tu primer programa y hacé que algo cobre vida en pantalla.",
        intro: "Vas a aprender a pensar como programador: dividir un problema en pasos, escribir código y ver el resultado al instante.",
        youWill: [
            "Entender variables, condiciones y bucles con ejemplos visuales",
            "Programar una mini app interactiva",
            "Presentar tu proyecto al resto del grupo",
        ],
        takeHome: "Tu proyecto publicado con un link para compartir.",
        turnos: ["TM", "TT"],
        media: "",
    },
    {
        id: "videojuegos",
        name: "Game Development",
        color: "red",
        icon: "▶",
        short: "Diseñá las reglas, los niveles y jugá tu propio videojuego.",
        intro: "Del papel a la pantalla: vas a idear un juego, diseñar sus reglas y construir un nivel jugable.",
        youWill: [
            "Diseñar la mecánica y el objetivo de tu juego",
            "Crear personajes, obstáculos y puntaje",
            "Probar el juego de otros equipos y mejorar el tuyo",
        ],
        takeHome: "Un nivel jugable para mostrarle a tu familia y amigos.",
        turnos: ["TM", "TT"],
        media: "",
    },
    {
        id: "animacion",
        name: "Animación",
        color: "yellow",
        icon: "✦",
        short: "Del boceto al movimiento: creá una animación corta cuadro a cuadro.",
        intro: "Vas a descubrir cómo se crea la ilusión de movimiento y a animar tu propio personaje.",
        youWill: [
            "Aprender los principios básicos de la animación",
            "Dibujar y animar una secuencia cuadro a cuadro",
            "Sumarle sonido y exportarla",
        ],
        takeHome: "Un clip animado listo para subir a redes.",
        turnos: ["TM", "TT"],
        media: "",
    },
    {
        id: "robotica",
        name: "Robótica",
        color: "dark",
        icon: "⚙",
        short: "Armá, conectá y programá un robot que resuelva un desafío.",
        intro: "Sensores, motores y código: vas a armar un robot en equipo y programarlo para superar una pista.",
        youWill: [
            "Conocer los componentes de un robot y cómo se conectan",
            "Programar movimientos y lecturas de sensores",
            "Competir en el desafío final por equipos",
        ],
        takeHome: "La experiencia de haber construido y programado un robot real.",
        turnos: ["TM", "TT"],
        media: "",
    },
];

const findLab = (id) => LABS.find((lab) => lab.id === id);
