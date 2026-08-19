# No-Show Killer

Confirms tomorrow's appointments by phone with CALL-E, and lets people reschedule
on the call. Backend triggers/tracks calls via the `calle` CLI; frontend is a
plain HTML/JS dashboard that polls the backend for live status.

## Structure

```
backend/    Express API — appointment store + calle CLI wrapper
frontend/   Static dashboard (no build step) — open index.html directly
```

## Run it

```bash
cd backend
npm install
npm start          # http://localhost:4000
```

Then open `frontend/index.html` in a browser (or `npx serve frontend`).

Demo data lives in `backend/data/appointments.json` — three fake appointments
dated for "tomorrow" relative to when you set it up. Edit phone numbers/dates
there, or wire in a real source (Google Calendar API, Airtable, etc.) by
replacing `loadAppointments`/`saveAppointments` in `backend/server.js`.

## How it talks to CALL-E

`backend/calle.js` shells out to the `calle` CLI (installed globally, already
authenticated). No MCP server code needed — the CLI talks to CALL-E's hosted
MCP server for you.

- `POST /api/appointments/:id/confirm` → `calle call start` for one appointment
- `POST /api/confirm-tomorrow` → same, batched for every `PENDING` appointment
  scheduled tomorrow (this is what a cron job would call nightly)
- Both start a background poll loop (`calle call status`) every 3s until a
  terminal status, writing progress back to `appointments.json`

## One thing to verify before a real demo

The exact JSON field names for `calle call start`/`call status` output
(`run_id`, `status_result.structuredContent`, `result.structuredContent`) are
taken from the CLI's documented shape — I haven't fired a real call yet to
confirm it byte-for-byte, since that would place an actual phone call to
whatever number you put in the demo data. Before your first real test call:

1. Put your own real phone number in one appointment in `appointments.json`
2. Click "Send confirmation call" for that card
3. Check the backend terminal output / `data/appointments.json` after — if the
   status/activity fields don't populate, run `calle call start --to-phone
   <your number> --goal "test" --json` directly and adjust the field paths in
   `server.js`'s `extractFields`/`triggerCall` to match

## Nightly cron

`server.js` schedules `runNightlyBatch()` (same logic as `POST
/api/confirm-tomorrow`) via `node-cron`, running as long as the backend
process stays up. Default: 6pm daily, in your system's local timezone.
Override with env vars:

```bash
CRON_SCHEDULE="0 9 * * *" CRON_TIMEZONE="America/Los_Angeles" npm start
```

`CRON_SCHEDULE` is a standard 5-field cron expression. This only fires while
`npm start` is running — for a real deployment, either keep the process alive
long-term (Render/Fly/Railway background worker) or drop the cron block and
call `POST /api/confirm-tomorrow` from a platform-level scheduled job instead
(e.g. a serverless cron trigger) if you'd rather not manage a long-running
process.

## Next steps for a real deployment

- Swap the JSON file for Google Calendar/Airtable so appointments are real
- Deploy backend (Render/Fly/Railway) and frontend (Vercel/Netlify/S3) —
  update `API_BASE` in `frontend/app.js` to the deployed backend URL
