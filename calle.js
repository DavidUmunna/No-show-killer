import dotenv from 'dotenv';
dotenv.config();
import { execFile } from 'child_process';

// Defaults, overridable per-call or via env vars.
const DEFAULT_REGION = process.env.CALLE_REGION || null;
const DEFAULT_TIMEOUT_SECONDS = process.env.CALLE_TIMEOUT_SECONDS || null;

function runCalle(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "calle",
      [...args, "--json"],
      {
        env: {
          ...process.env,
          CALLE_API_KEY: process.env.CALLE_API_KEY,
        },
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          reject(new Error(stderr || err.message));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error(`Failed to parse calle output: ${stdout}`));
        }
      }
    );
  });
}

export function authStatus() {
  return runCalle(["auth", "status"]);
}

// Plans and starts a call in one step. Response shape (per calle CLI docs):
// { ok, run_id, status_result: { structuredContent: { status, activity, ... } } }
//
// region / timeoutSeconds default to CALLE_REGION / CALLE_TIMEOUT_SECONDS env
// vars when not passed explicitly, so you can tune them without code changes.
export function startCall({ toPhone, goal, region, timeoutSeconds }) {
  const args = ["call", "start", "--to-phone", toPhone, "--goal", goal];

  const resolvedRegion = region ?? DEFAULT_REGION;
  if (resolvedRegion) {
    args.push("--region", resolvedRegion);
  }

  const resolvedTimeout = timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  if (resolvedTimeout) {
    args.push("--timeout-seconds", String(resolvedTimeout));
  }

  return runCalle(args);
}

// Response shape: { ok, result: { structuredContent: { status, activity, ... } } }
export function callStatus({ runId }) {
  return runCalle(["call", "status", "--run-id", runId]);
}