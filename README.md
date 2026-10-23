# Tumo-Flashlab
Repository created for the tumo flash lab of december

- `index.html`, `script.js`: landing page with the lab cards and detail panel
- `inscripcion.html`, `form.js`: registration form (`?lab=id` preselects a lab)
- `config.js`: labs, turnos and the backend URL, shared by both pages
- `style.css`: styles (brand colors from the TUMO BA identity manual)
- `apps-script/Code.gs`: Google Sheets back (cartelera, DNI verification, requests, team edits, emails)
- `api/inscripcion.js`: Vercel bridge between the site and the Apps Script (hides the key, rate limit, timeout)
- `chatbot.js`, `api/chat.js`: "Flashy" chatbot (Groq) — see SETUP.md
- `SETUP.md`: how to connect the sheet, the emails and the chatbot
