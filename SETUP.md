# Registration backend: setup

The registration form lives on the website (`inscripcion.html`). It sends each sign-up to a
**Google Apps Script** web app that writes it into a **Google Sheet** and sends every email.
No server to host. The website stays static (e.g. GitHub Pages). No Google Form needed.

```
 index.html ──"Inscribirme" (?lab=…)──▶ inscripcion.html
                                            │  POST registration
                                            │  GET  ?action=status&dni=…
                                            ▼
                                   Apps Script (Code.gs) ──▶ Google Sheet "Inscripciones"
                                   ├─ blocks duplicate DNI
                                   ├─ emails student + guardian
                                   ├─ confirm link (?action=confirm&token=…)
                                   └─ hourly + daily jobs
```

## Participant lifecycle

Capacity is **20 per lab and per turno** (TM / TT).

| Event | New status | Email (to student + guardian) |
|---|---|---|
| Form submitted | `registered` | "We received your registration" + **Confirm** button |
| Same DNI already has an active registration | not saved | Form shows "already registered" (blocks a 2nd lab) |
| 24 h without confirming | — | Reminder: "Remember to confirm" |
| Clicks Confirm, slot has < 20 confirmed | `confirmed` | "Your spot is secured" + when/where |
| Clicks Confirm, slot already full | `waitlist` | "You're on the waiting list" |
| 48 h without confirming | `expired` | "You lost your spot" |
| Staff set a confirmed row to `cancelled` | first `waitlist` of that slot → `confirmed` | "A spot opened up for you" |
| 2 days before / morning of the event | — | "See you on…" + address |

## Step by step

1. Create an empty **Google Sheet** with a TUMO account.
2. **Extensions → Apps Script**, delete the sample code and paste `apps-script/Code.gs`.
   Fill in `EVENT` (date, address, start). Keep `LABS` / `TURNOS` in sync with `config.js`.
3. Select `setup` in the toolbar → **Run** once. It creates the "Inscripciones" tab and the timers. Accept the permissions.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the `/exec` URL.
5. In `config.js` set `API_URL: "https://script.google.com/macros/s/…/exec"`.
6. Test: sign up with your own DNI and email → get the email → click Confirm → check the status box on the form page.

After editing `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the same URL picks up the change.

## Adding or changing a Flash Lab

Edit `LABS` in `config.js` (name, color, texts, turnos, optional `media` GIF/video for the panel header)
and add the same `id` to `LABS` in `Code.gs`.

## Things to decide with the team

- **Sending account:** emails go out from the account that owns the script. Quotas: ~100/day on free Gmail, ~1500/day on Google Workspace. Each send counts 2 recipients.
- **One spot per event or across events?** Right now "active" means any registered/confirmed/waitlist row in this sheet. Use a new sheet per event to reset it.
- **Confirmation window:** `EVENT.CONFIRM_HOURS` (48 h). Shorten it close to the event date.
- **Privacy:** the status lookup only returns a status word, never names, emails or documents.
