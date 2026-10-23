# Back de inscripciones: puesta en marcha

TUMO Barracas · FlashLabs diciembre 2026

```
Web (Vercel) ──▶ /api/inscripcion (Vercel) ──▶ Apps Script (Code.gs) ──▶ Google Sheets
                 oculta la URL y la clave,       valida, registra,         toda la información
                 limita intentos, timeout 15 s   manda mails               (el equipo trabaja acá)
```

## 1. Crear la planilla (una sola vez)

1. Entrá a **sheets.new** con tu cuenta de Google. Se crea una planilla en blanco. Ponele de nombre "FlashLabs Diciembre 2026".
2. **Extensiones → Apps Script**. Borrá el código de ejemplo y pegá todo `apps-script/Code.gs`. Guardá (Ctrl+S).
3. Arriba, en el selector de funciones, elegí **setup** → **Ejecutar**.
   - Google pide permisos ("Esta app no está verificada") → **Configuración avanzada → Ir a … (no seguro) → Permitir**. Es normal: el script es tuyo.
   - Al terminar aparece la **clave de la API**. Copiala (se puede volver a ver con el menú **FlashLabs → Ver clave de la API**).
4. Volvé a la planilla: ya tiene las pestañas **Resumen, Actividades, Estudiantes, Solicitudes, Historial, Mensajes y Config**, con las 8 actividades del cronograma y 5 estudiantes **de prueba**.

## 2. Publicar la API

1. En Apps Script: **Implementar → Nueva implementación** → tipo **Aplicación web**.
   - Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier usuario**.
2. Copiá la URL que termina en `/exec`.
3. En Vercel → proyecto → **Settings → Environments → Production → Environment Variables**, agregá:
   - `APPS_SCRIPT_URL` = la URL `/exec`
   - `APPS_SCRIPT_KEY` = la clave del paso 1.3
4. Redeploy (o push). Probá: `https://tumoflashlab.vercel.app/api/inscripcion?action=actividades` debe devolver las actividades.

> Cada vez que cambies `Code.gs`: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva → Implementar**. Así la URL no cambia.

## 3. Cómo se usa la planilla

| Pestaña | Para qué |
|---|---|
| **Resumen** | Vacantes por actividad y grupo (se calcula sola, no se edita). |
| **Actividades** | La cartelera. `Habilitado` = SÍ/NO (los grupos B arrancan en NO). `Inscripción` = Abierta / Lista de espera / Cerrada. `Capacidad` por grupo. `Docentes` no se muestra en la web. |
| **Estudiantes** | La bajada del 360. Hoy tiene 5 estudiantes de prueba (DNI 40000001 a 40000005): reemplazalos por la bajada real. |
| **Solicitudes** | Una fila por solicitud. **El equipo cambia la columna `Estado`** (menú desplegable). |
| **Historial** | Cada cambio de estado: quién, cuándo, antes y después. No editar. |
| **Mensajes** | Textos de los mails. Se pueden editar; `{nombre}`, `{actividad}`, `{grupo}`, `{dias}`, `{horario}`, `{contacto}` se reemplazan solos. |
| **Config** | Abrir/cerrar todo, capacidad por defecto, **modo prueba**, plazo de invitación, contacto. |

**Confirmar vacantes:** en Solicitudes, cambiá `Estado` a **Confirmada**. Si el grupo ya está completo, la planilla lo rechaza y avisa. Al confirmar se manda el mail de confirmación. También mandan mail: Lista de espera, Cancelada y No elegible.

**Modo prueba:** en Config, *"Modo prueba: enviar todos los mails a"* tiene tu mail. Mientras esté lleno, **todos** los mails te llegan a vos (con el destinatario real en el asunto). Vacialo cuando se lance.

## 4. Reglas que aplica el sistema

- **Identidad:** el DNI tiene que estar en Estudiantes. El nombre se compara sin tildes ni mayúsculas (alcanza con un nombre y un apellido). Nunca se muestra el nombre registrado.
- **Una sola solicitud activa por DNI.** Activas: Recibida, En validación, Pendiente de confirmación, Confirmada, Lista de espera, Vacante ofrecida. Si se cancela, puede volver a inscribirse.
- **Vacantes:** una solicitud nueva queda *Pendiente de confirmación* mientras Pendientes + Confirmadas + Ofrecidas < Capacidad. Si no, entra en *Lista de espera*. Recibir una solicitud **no** la confirma: confirma el equipo.
- **Requisitos:** en Actividades, `Requisito` es el texto que ve el estudiante y `Columna requisito` es el nombre de una columna de Estudiantes (ej. "Robótica completada").
  - SÍ / x / completado → cumple.
  - NO → no cumple: se bloquea y se muestra el motivo.
  - Vacío, o la columna no existe → **no se puede verificar**: se registra como *En validación* para revisar a mano.

## 5. Pendiente para las próximas fases

- Fase 3-4: la web todavía usa el formulario viejo. Hay que conectar la cartelera y el formulario nuevo (nombre + DNI, verificación en tiempo real, 3 confirmaciones).
- Fase 6: invitaciones automáticas desde la lista de espera (plazo en Config).
- Descripciones e imágenes de cada actividad (columnas `Descripción` e `Imagen`).
- Mover la planilla a la cuenta de TUMO cuando esté (Archivo → Hacer una copia, y repetir los pasos 1.3 y 2).

---

# Chatbot "Flashy" (Groq)

The bottom-right robot answers questions about the Flash Lab using Groq's AI.
The browser talks to `/api/chat` (a Vercel serverless function in `api/chat.js`),
which adds the event info from `config.js` and calls Groq. The Groq key never reaches the browser.

1. Create a free account at **console.groq.com** → **API Keys** → **Create API Key**. Copy it (starts with `gsk_`).
2. In Vercel: project **tumoflashlab** → **Settings → Environment Variables** → add
   - Name: `GROQ_API_KEY` · Value: your key · Environments: Production + Preview
3. **Deployments** → latest → **⋯ → Redeploy** (env vars only apply to new deployments).
4. Open the site, click the robot and ask something.

Optional: `GROQ_MODEL` changes the model (default `openai/gpt-oss-20b`; e.g. `llama-3.3-70b-versatile`).

**What the bot knows:** only what's in `config.js` (`EVENT`, `LABS`, `TURNOS`). Update those and push; the bot updates too.
Set `EVENT.contact` to an email so the bot can point people there when it doesn't know an answer.

**Local testing:** create `Tumo-Flashlab/.env.local` with `GROQ_API_KEY=gsk_...` (it's git-ignored, never commit it).
