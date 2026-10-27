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
| **Estudiantes** | **No se edita a mano**: la llena la sincronización (ver sección 3b). Documento, nombre, mails de contacto, estado del 360 y una columna por curso (Music_I, Programming_II…). |
| **Estudiantes manuales** | Estudiantes que todavía no están en el origen (o para corregir uno). Mismas columnas; se suman en la próxima sincronización. |
| **Sync** | Reporte de cada sincronización: cuántos estudiantes, cuántos con cursos del 360, sin TUMO ID, duplicados. |
| **Solicitudes** | Una fila por solicitud. **El equipo cambia la columna `Estado`** (menú desplegable). |
| **Historial** | Cada cambio de estado: quién, cuándo, antes y después. No editar. |
| **Mensajes** | Textos de los mails. Se pueden editar; `{nombre}`, `{actividad}`, `{grupo}`, `{dias}`, `{horario}`, `{contacto}` se reemplazan solos. |
| **Config** | Abrir/cerrar todo, capacidad por defecto, **modo prueba**, plazo de invitación, contacto. |

**Confirmar vacantes:** en Solicitudes, cambiá `Estado` a **Confirmada**. Si el grupo ya está completo, la planilla lo rechaza y avisa. Al confirmar se manda el mail de confirmación. También mandan mail: Lista de espera, Cancelada y No elegible.

**Modo prueba:** en Config, *"Modo prueba: enviar todos los mails a"* tiene tu mail. Mientras esté lleno, **todos** los mails te llegan a vos (con el destinatario real en el asunto). Vacialo cuando se lance.

## 3b. Estudiantes reales (sincronización)

La pestaña Estudiantes se arma sola a partir de la planilla de inscripciones de TUMO:

```
pestaña "back"  (documento → TUMO ID, nombre, apellido, mails reales)
        └── TUMO ID ──► pestaña "360"  (estado y cursos: Music_I, Programming_II, …)
```

- El **documento** (DNI, pasaporte u otro) identifica al estudiante. El TUMO ID sólo se usa para traer los cursos.
- Se copian **sólo** las columnas que necesita el sistema. Direcciones, fechas de nacimiento y datos de los adultos no se copian.
- Los mails son los de "back" (columnas F y G), nunca el mail del 360.
- Si un documento aparece dos veces, se queda la fila que tiene datos del 360 (o la más reciente).

**Primera vez:**
1. En Config, `Origen estudiantes: planilla (ID o link)` → pegá el link de la planilla de inscripciones. El dueño de este script tiene que poder abrirla; **no hace falta (ni conviene) que sea pública**.
2. Revisá las letras de las columnas de "back" en Config (documento P, tipo O, TUMO ID L, apellido M, nombre N, mail F, mail 2 G). Si alguien agrega o mueve columnas en "back", se cambia la letra acá.
3. Menú **FlashLabs → Sincronizar estudiantes ahora**. Google va a pedir permiso para leer la otra planilla: aceptalo.
4. Mirá la pestaña **Sync**: cuántos estudiantes cargó y cuántos tienen cursos del 360.

Después se sincroniza **sola todas las noches (3 AM)**. Si alguien se inscribe en TUMO durante el día, usá el menú para no esperar.

**¿Por qué un estudiante no pasa?** Menú **FlashLabs → Revisar un documento…** y escribí su DNI. Muestra paso a paso:
1. si el documento está en "back",
2. si su TUMO ID está en el 360,
3. el valor de cada curso del requisito,
4. el resultado en cada FlashLab (✅ / ⛔ / ⚠️) y si ya tiene una solicitud activa.

La columna **Datos 360** de Estudiantes también lo resume: `OK`, `Sin TUMO ID en back` o `TUMO ID no está en el 360`.

## 4. Reglas que aplica el sistema

- **Identidad:** el documento (DNI, pasaporte u otro; 6 a 12 letras o números) tiene que estar en Estudiantes. El nombre se guarda como lo escribe el estudiante, pero **no se compara**.
- **Una sola solicitud activa por documento.** Activas: Recibida, En validación, Pendiente de confirmación, Confirmada, Lista de espera, Vacante ofrecida. Si se cancela, puede volver a inscribirse.
- **Estado del 360:** no filtra; cualquier estudiante puede pedir vacante.
- **Vacantes:** una solicitud nueva queda *Pendiente de confirmación* mientras Pendientes + Confirmadas + Ofrecidas < Capacidad. Si no, entra en *Lista de espera*. Recibir una solicitud **no** la confirma: confirma el equipo.
- **Requisitos:** en Actividades, `Requisito` es el texto que ve el estudiante y `Columna requisito` dice qué cursos del 360 se miran:
  - `Music_I` → hace falta ese curso.
  - `Programming_II o Music_II` → alcanza con uno.
  - `Graphic_Design_I y 3D_Modeling_I` → hacen falta todos.
  - `Valor requerido`: vacío o `Completed` = haberlo aprobado. `Prerequisite Done` = alcanza con estar habilitado para cursarlo.

  | Valor del 360 | Resultado |
  |---|---|
  | Completed / Completed ⭐ | ✅ cumple |
  | Prerequisite Done | ✅ sólo si Valor requerido = Prerequisite Done; si no, ⛔ |
  | Prerequisite Not Done | ⛔ no cumple: se bloquea y se muestra el motivo |
  | Prerequisite Conditional, o sin datos del 360 (sin TUMO ID) | ⚠️ no se puede verificar → se registra *En validación* |

- **Descripciones y requisitos** de "Flash Labs" ya están cargados en el código: menú **FlashLabs → Actualizar descripciones y requisitos** los vuelca en Actividades (pisa nombre, descripción, requisito, regla, capacidad y herramientas).

## 5. La web

- **Cartelera** (`index.html` + `script.js`): lee la pestaña Actividades. Muestra sólo las filas con `Habilitado = SÍ`, con su estado (abierta / lista de espera / cerrada), horario, capacidad y requisitos. Los cambios en la planilla tardan hasta ~30 s en verse.
- **Solicitud** (`inscripcion.html?actividad=<ID>` + `form.js`):
  1. Al llegar, pregunta "¿Querés solicitar una vacante en …?" (Sí, continuar / Volver a la cartelera).
  2. Muestra la actividad elegida (días, horario, requisitos) con "Cambiar actividad".
  3. Pide nombre y apellido + DNI. El DNI se verifica mientras se escribe ("Verificando…"); el nombre se compara al salir del campo.
  4. Casilla "Confirmo que quiero solicitar una vacante en …" antes de enviar.
  5. «¡Recibimos tu inscripción!» aparece **sólo** si la planilla confirmó que la guardó.
- **Chatbot**: usa `config.js` (reglas generales) + la cartelera de la planilla (cacheada 1 minuto).
- `EVENT.contact` en `config.js`: si lo completás, los mensajes de error dicen "escribinos a …" en lugar de "acercate a la recepción".

## 6. Actualizar el script después de un cambio en Code.gs

Pegá el `Code.gs` nuevo en Apps Script, guardá y **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. La URL no cambia, no hay que tocar Vercel.

## 7. Pendiente para las próximas fases

- Fase 5-6: invitaciones automáticas desde la lista de espera (plazo en Config) y vencimientos.
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
