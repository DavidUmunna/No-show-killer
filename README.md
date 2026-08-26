# No-Show Killer

Confirms tomorrow's appointments by phone with CALL-E, and lets people reschedule
on the call. Backend triggers/tracks calls via the `calle` CLI; frontend is a
plain HTML/JS dashboard that polls the backend for live status.

**Runs in dry-run mode by default** - no real phone call is placed until you
explicitly set `DRY_RUN=false`. See "Dry-run mode" below.

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

## Dry-run mode (default: on)

`DRY_RUN` defaults to `true` (see `backend/.env.example`). While it's on,
`backend/calle.js` never shells out to the real `calle` CLI - `startCall()`
and `callStatus()` return a synthetic response in the same shape a real call
produces (status `COMPLETED`, a fake `run_id`, a `[DRY RUN]`-prefixed
summary), so the rest of the app - status polling, the WebSocket updates, the
UI, `appointments.json` - exercises its real code paths without spending
money or ringing anyone's phone. The backend logs `[dry-run] would call
<masked number> (goal set, not logged)` for every simulated call - the
destination is masked and the goal text (which includes the patient's name
and appointment details) is never printed at all - and `GET /api/health`
reports the current `dryRun` value.

## Verify it works

No external test framework is used - `npm test` (from `backend/`) runs
`scripts/smoke-test.mjs`, which fires a dry-run `startCall()`/`callStatus()`
pair against a fictional sample number and asserts the fields the app relies
on come back in the right shape. It refuses to run at all if `DRY_RUN=false`,
so it can never place a real call. This is also a good manual check after
pulling the repo: `cd backend && npm install && npm test`.

## Go live with real calls

The exact JSON field names for `calle call start`/`call status` output
(`run_id`, `status_result.structuredContent`, `result.structuredContent`) are
taken from the CLI's documented shape - they haven't been confirmed against a
real phone call. Before your first real test call:

1. Set `DRY_RUN=false` (env var or in `.env`)
2. Put your own real phone number in one appointment in `appointments.json`
3. Click "Send confirmation call" for that card
4. Check the backend terminal output / `data/appointments.json` after — if the
   status/activity fields don't populate, run `calle call start --to-phone
   <your number> --goal "test" --json` directly and adjust the field paths in
   `server.js`'s `extractFields`/`triggerCall` to match

Once you're confident it works, set `DRY_RUN=false` for real usage. There is
no way to cancel a call after it starts ringing - the `calle` CLI doesn't
expose a cancel/hangup command, so `triggerCall()`'s existing guard (refusing
a second call while one is already in flight for the same appointment) is the
only in-flight protection available.

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

### Turn off the nightly cron

Set `CRON_ENABLED=false` (env var or in `.env`) and restart the backend - the
recurring job is skipped entirely and the startup log says so. This doesn't
touch code, so it's safe to flip on/off per environment. The one-off `POST
/api/confirm-tomorrow` and `POST /api/appointments/:id/confirm` endpoints keep
working either way; only the automatic nightly firing is disabled.
Stopping the `npm start` process (e.g. `Ctrl+C`, or stopping the deployed
worker) also stops it, since the schedule only runs while that process is
alive.

## Next steps for a real deployment

- Swap the JSON file for Google Calendar/Airtable so appointments are real
- Deploy backend (Render/Fly/Railway) and frontend (Vercel/Netlify/S3) —
  update `API_BASE` in `frontend/app.js` to the deployed backend URL
