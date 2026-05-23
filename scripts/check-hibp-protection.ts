#!/usr/bin/env bun
/**
 * CI guard: leaked-password (HIBP) protection must remain enabled, and no
 * code path in the repo may bypass it.
 *
 * Two independent checks run; either failure exits non-zero.
 *
 *  1. Remote config check (skipped if SUPABASE_ACCESS_TOKEN is not set).
 *     Calls the Supabase Management API and asserts
 *     `password_hibp_enabled === true` on the configured project.
 *
 *  2. Static source check (always runs). Scans `src/` and
 *     `supabase/functions/` for patterns that would either disable HIBP at
 *     runtime or set passwords via channels that skip it — notably:
 *       - `auth.admin.createUser` / `auth.admin.updateUserById` with a
 *         `password` field (server-side admin API bypasses HIBP).
 *       - Edge functions calling the GoTrue admin REST endpoints
 *         (`/auth/v1/admin/users`) with a password payload.
 *       - Any call to `configure_auth` / management API setting
 *         `password_hibp_enabled: false`.
 *       - `signInWithPassword` is fine; sign-in does not set passwords.
 *
 * Run locally:  bun run scripts/check-hibp-protection.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ?? "sconwppegcxhpgdntsct";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const failures: string[] = [];

// ---------- 1. Remote config check ----------

async function remoteCheck() {
  if (!ACCESS_TOKEN) {
    console.log(
      "::warning::SUPABASE_ACCESS_TOKEN not set; skipping live HIBP config check. " +
        "Set this secret in CI to enforce the project-level guard.",
    );
    return;
  }
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
  } catch (e) {
    failures.push(`HIBP config fetch failed: ${(e as Error).message}`);
    return;
  }
  if (!res.ok) {
    failures.push(
      `HIBP config fetch returned ${res.status} ${res.statusText}: ${await res
        .text()
        .catch(() => "")}`,
    );
    return;
  }
  const cfg = (await res.json()) as Record<string, unknown>;
  if (cfg.password_hibp_enabled !== true) {
    failures.push(
      `Leaked-password (HIBP) protection is DISABLED on project ${PROJECT_REF}. ` +
        `Re-enable it in Cloud → Users → Auth Settings, or via configure_auth.`,
    );
  } else {
    console.log(
      `OK: HIBP protection enabled on project ${PROJECT_REF}.`,
    );
  }
}

// ---------- 2. Static source check ----------

const SCAN_DIRS = ["src", "supabase/functions"];
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", "build", ".turbo"]);
// This file itself describes the forbidden patterns — don't flag it.
const SELF_PATH = "scripts/check-hibp-protection.ts";

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) yield* walk(p);
    else if (SCAN_EXTS.has(p.slice(p.lastIndexOf("."))) ) yield p;
  }
}

type Rule = {
  id: string;
  re: RegExp;
  message: string;
};

const RULES: Rule[] = [
  {
    id: "admin-create-user-password",
    // auth.admin.createUser({ ... password: ... })
    re: /auth\.admin\.createUser\s*\([^)]*\bpassword\b/s,
    message:
      "auth.admin.createUser with a password bypasses HIBP. Use the standard signUp flow or an invite link.",
  },
  {
    id: "admin-update-user-password",
    re: /auth\.admin\.updateUserById\s*\([^)]*\bpassword\b/s,
    message:
      "auth.admin.updateUserById with a password bypasses HIBP. Have the user reset via the email-based recovery flow.",
  },
  {
    id: "admin-rest-users-password",
    re: /\/auth\/v1\/admin\/users\b[\s\S]{0,400}?\bpassword\s*:/,
    message:
      "Calling the GoTrue /auth/v1/admin/users endpoint with a password bypasses HIBP.",
  },
  {
    id: "hibp-disabled-flag",
    re: /password_hibp_enabled\s*:\s*false\b/,
    message:
      "Found password_hibp_enabled: false. Leaked-password protection must stay enabled.",
  },
];

function staticCheck() {
  let scanned = 0;
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      if (rel === SELF_PATH) continue;
      scanned++;
      const text = readFileSync(file, "utf8");
      for (const rule of RULES) {
        const m = text.match(rule.re);
        if (m) {
          // Find a 1-indexed line number for nicer CI annotations.
          const upto = text.slice(0, m.index ?? 0);
          const line = upto.split("\n").length;
          failures.push(
            `${rel}:${line}  [${rule.id}] ${rule.message}`,
          );
        }
      }
    }
  }
  console.log(
    `Static HIBP-bypass scan: ${scanned} file(s) checked against ${RULES.length} rule(s).`,
  );
}

// ---------- Run ----------

await remoteCheck();
staticCheck();

if (failures.length) {
  for (const f of failures) {
    console.log(`::error::${f.replace(/\n/g, "%0A")}`);
  }
  console.error(
    `\nHIBP protection check failed with ${failures.length} issue(s).`,
  );
  process.exit(1);
}

console.log("HIBP protection check passed.");
