import dotenv from 'dotenv';
dotenv.config();
import { execFile } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the CLI by path instead of relying on `calle` being on $PATH.
// `@call-e/cli` is a regular dependency (see package.json), so this works
// the same way locally and on Railway regardless of how the start script
// sets up PATH.
const CALLE_BIN = path.join(
  __dirname,
  "node_modules",
  "@call-e",
  "cli",
  "bin",
  "calle.js"
);

// Defaults, overridable per-call or via env vars.
const DEFAULT_REGION = process.env.CALLE_REGION || null;
const DEFAULT_TIMEOUT_SECONDS = process.env.CALLE_TIMEOUT_SECONDS || null;

// Where the CLI reads/writes its OAuth token cache. Must point at a
// persistent path (e.g. a mounted Railway volume) in production - a
// container's default $HOME is wiped on every redeploy, which is what was
// breaking auth. See README/deploy notes for the one-time login step that
// populates this path.
const CACHE_ROOT = process.env.CALLE_CACHE_ROOT || null;

function runCalle(args) {
  const finalArgs = CACHE_ROOT
    ? [...args, "--cache-root", CACHE_ROOT, "--json"]
    : [...args, "--json"];

  return new Promise((resolve, reject) => {
    execFile(
      process.execPath, // node
      [CALLE_BIN, ...finalArgs],
      {
        env: process.env,
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