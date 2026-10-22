# Registration backend: setup

Everything runs on free Google tools: **Google Form → Google Sheet → Apps Script**.
No server to host. The website stays a static page (e.g. on GitHub Pages).

```
 Website ──"Ir al formulario"──▶ Google Form ──▶ Google Sheet (responses)
    ▲                                                 │
    │  fetch ?action=board / ?action=status           │ onFormSubmit trigger
    │                                                 ▼
    └──────────────────────────────────────── Apps Script (Code.gs)
                                               ├─ checks duplicates
                                               ├─ sends every email
                                               ├─ confirm link (Web App)
                                               └─ hourly + daily jobs
```

## Participant lifecycle

| Event | New status | Email sent |
|---|---|---|
| Form submitted | `registered` | 1. "We received your registration" + **Confirm** button |
| Same participant (DNI) already has an active spot | `duplicate` | "You already have a registration" (blocks a 2nd course) |
| 24 h without confirming | — | Reminder: "Remember to confirm" |
| Clicks Confirm, fewer than 20 confirmed | `confirmed` | 2+3. "Your spot is secured" + when/where |
| Clicks Confirm, already 20 confirmed | `waitlist` | "You're on the waiting list" |
| 48 h without confirming | `expired` | 4. "You lost your spot" |
| A confirmed person is set to `cancelled` by staff | first `waitlist` → `confirmed` | "A spot opened up for you" |
| 2 days before / morning of the event | — | 5. "See you on…" + address |

**Why DNI and not email:** a parent may register two kids with the same email. Using the participant's
DNI as the unique key means each kid counts once and nobody can hold two spots or switch courses.

## Step by step

1. **Create the Google Form** with these questions (titles must match `FORM` in `Code.gs`):
   - Nombre del participante
   - Apellido del participante
   - DNI del participante (short answer, numeric validation)
   - Email de contacto (or turn on "Collect emails")
   - Actividad (multiple choice: Programación, Game Development, Animación, Robótica)
   - Also: date of birth, phone, guardian name + consent checkbox.
2. In the form: **Responses → Link to Sheets** (create a new sheet).
3. In the sheet: **Extensions → Apps Script**, delete the sample code and paste `apps-script/Code.gs`.
   - Check `SHEET_NAME` matches the responses tab name.
   - If the form is in English the timestamp column is `Timestamp` instead of `Marca temporal`; update `hourlyJob`.
   - Fill in `EVENT` (date, time, address, start date).
4. Run `installTriggers` once (select it in the toolbar → Run). Accept the permissions prompt.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me** · Who has access: **Anyone**
   - Copy the `/exec` URL.
6. In `script.js` set:
   ```js
   FORM_URL: "https://forms.gle/…",
   API_URL:  "https://script.google.com/macros/s/…/exec",
   ```
   The "Top 20 confirmados" board and the "Consultar mi estado" box switch from demo data to live data.
7. Test with your own email: submit → get email 1 → click confirm → see your name on the website.

## Things to decide with the team

- **Sending account:** emails go out from the Google account that owns the script. Use a TUMO account,
  not a personal one. Quotas: ~100 emails/day on a free Gmail, ~1500/day on Google Workspace.
- **One spot per event or across events?** Right now "active" = registered/confirmed/waitlist in *this* sheet.
  If you run several Flash Labs, keep them in one sheet with an "Evento" column, or check a shared list.
- **Confirmation window:** 48 h is in `EVENT.CONFIRM_HOURS`. Shorten it close to the event date.
- **Privacy:** the public board shows only first name + last initial. The status lookup by email only
  returns a status word, never names or DNI.
- **Cancelling:** staff change a row's `Estado` to `cancelled`; within the hour the next waitlisted person is promoted and emailed.
