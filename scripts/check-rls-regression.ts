#!/usr/bin/env bun
/**
 * RLS regression guard.
 *
 * Replays every SQL file in supabase/migrations (lexicographic order) and
 * reconstructs the *current* CREATE POLICY definition for each
 * (schema, table, command, policy_name) tuple. DROP POLICY removes entries.
 *
 * Then, for each rule in supabase/security/sensitive-policies.json, checks
 * that *at least one* surviving policy on the (table, command) still
 * contains every `requireAll` token and none of the `forbid` tokens.
 *
 * Exits non-zero (and prints a GitHub-Actions `::error::` line) on any
 * regression so the workflow fails.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Rule = {
  table: string;
  command: string;
  requireAll?: string[];
  forbid?: string[];
  reason?: string;
};

type PolicyKey = string; // `${schema}.${table}|${command}|${name}`
type Policy = { schema: string; table: string; command: string; name: string; body: string };

const ROOT = process.cwd();
const MIG_DIR = join(ROOT, "supabase", "migrations");
const RULES_PATH = join(ROOT, "supabase", "security", "sensitive-policies.json");

function readMigrations(): string {
  let files: string[];
  try {
    files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.log("No migrations directory; skipping RLS regression check.");
    process.exit(0);
  }
  return files.map((f) => `-- FILE: ${f}\n${readFileSync(join(MIG_DIR, f), "utf8")}`).join("\n");
}

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitStatements(sql: string): string[] {
  // Naive but adequate: split on `;` outside of `$$ ... $$` blocks.
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    const two = sql.slice(i, i + 2);
    if (two === "$$") {
      inDollar = !inDollar;
      buf += two;
      i++;
      continue;
    }
    const c = sql[i];
    if (c === ";" && !inDollar) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += c;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

function qualify(name: string, defaultSchema = "public"): { schema: string; table: string } {
  const parts = name.replace(/"/g, "").split(".");
  if (parts.length === 2) return { schema: parts[0], table: parts[1] };
  return { schema: defaultSchema, table: parts[0] };
}

const policies = new Map<PolicyKey, Policy>();

const createRe =
  /^CREATE\s+POLICY\s+(?:"([^"]+)"|(\S+))\s+ON\s+([A-Za-z0-9_."]+)\s+([\s\S]+)$/i;
const dropRe = /^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|(\S+))\s+ON\s+([A-Za-z0-9_."]+)/i;

function commandFrom(body: string): string {
  const m = body.match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i);
  return (m ? m[1] : "ALL").toUpperCase();
}

function ingest(stmt: string) {
  const upper = stmt.toUpperCase();
  if (upper.startsWith("CREATE POLICY")) {
    const m = stmt.match(createRe);
    if (!m) return;
    const name = m[1] ?? m[2];
    const target = m[3];
    const body = m[4];
    const { schema, table } = qualify(target);
    const command = commandFrom(body);
    const key = `${schema}.${table}|${command}|${name}`;
    policies.set(key, { schema, table, command, name, body: `CREATE POLICY "${name}" ON ${schema}.${table} ${body}` });
    return;
  }
  if (upper.startsWith("DROP POLICY")) {
    const m = stmt.match(dropRe);
    if (!m) return;
    const name = m[1] ?? m[2];
    const target = m[3];
    const { schema, table } = qualify(target);
    for (const cmd of ["ALL", "SELECT", "INSERT", "UPDATE", "DELETE"]) {
      policies.delete(`${schema}.${table}|${cmd}|${name}`);
    }
  }
}

function main() {
  const all = readMigrations();
  for (const stmt of splitStatements(stripComments(all))) ingest(stmt);

  const rules: Rule[] = JSON.parse(readFileSync(RULES_PATH, "utf8")).rules;
  const failures: string[] = [];

  for (const rule of rules) {
    const want = rule.command.toUpperCase();
    const matches = [...policies.values()].filter(
      (p) =>
        `${p.schema}.${p.table}` === rule.table &&
        (p.command === want || p.command === "ALL"),
    );

    if (matches.length === 0) {
      failures.push(
        `Missing policy on ${rule.table} for ${rule.command}. Required guards: ${(rule.requireAll ?? []).join(", ")}. Reason: ${rule.reason ?? "n/a"}`,
      );
      continue;
    }

    const ok = matches.some((p) => {
      const body = p.body;
      const hasAll = (rule.requireAll ?? []).every((tok) => body.includes(tok));
      const hasForbid = (rule.forbid ?? []).some((tok) => body.includes(tok));
      return hasAll && !hasForbid;
    });

    if (!ok) {
      failures.push(
        `Sensitive policy regression: ${rule.table} ${rule.command} no longer satisfies required guards [${(rule.requireAll ?? []).join(", ")}] / forbids [${(rule.forbid ?? []).join(", ")}]. Reason: ${rule.reason ?? "n/a"}. Surviving policies:\n  - ${matches.map((m) => m.name).join("\n  - ")}`,
      );
    }
  }

  if (failures.length) {
    for (const f of failures) console.log(`::error::${f.replace(/\n/g, "%0A")}`);
    console.error(`\nRLS regression check failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  console.log(`RLS regression check passed (${policies.size} policies replayed, ${rules.length} guards verified).`);
}

main();
