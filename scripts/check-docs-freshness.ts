#!/usr/bin/env bun
/**
 * CI guard: documentation must stay in sync with the repo.
 *
 * Three checks run; any failure exits non-zero.
 *
 *  1. File-path check (docs/filesExplainer.md)
 *     Every path mentioned inside the ``` code blocks describing the
 *     `src/`, `supabase/functions/`, and `scripts/` trees must exist on
 *     disk. Catches files that were deleted/renamed without a docs update.
 *
 *  2. Table check (docs/filesExplainer.md "Database" table)
 *     Every backticked identifier in the first markdown table must map to
 *     a `CREATE TABLE` / `CREATE MATERIALIZED VIEW` in
 *     supabase/migrations/. Catches tables that were removed/renamed.
 *
 *  3. CI-job check (docs/security-ci.md)
 *     Every job name in the first column of the security-ci.md jobs table
 *     must exist as a top-level job key in
 *     .github/workflows/security.yml. Catches workflow renames.
 *
 * Run locally:  bun run scripts/check-docs-freshness.ts
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const failures: string[] = [];

function fail(msg: string) {
  failures.push(msg);
}

// ---------- helpers ----------

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Extract ```...``` fenced blocks (ignores language tag). */
function fencedBlocks(md: string): string[] {
  const out: string[] = [];
  const re = /```[^\n]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push(m[1]);
  return out;
}

// ---------- 1. file-path check ----------

/**
 * Tree blocks in filesExplainer.md look like:
 *   src/
 *   ├── App.tsx                  ...
 *   │   ├── pages/
 *   │   │   ├── Auth.tsx         ...
 * We rebuild the full path from indentation depth.
 */
function extractTreePaths(block: string, rootHint: string): string[] {
  const lines = block.split("\n");
  const stack: string[] = []; // path segments by depth
  const paths: string[] = [];
  let root = rootHint;

  for (const raw of lines) {
    // Detect the root header line, e.g. "src/" or "supabase/functions/"
    const headerMatch = raw.match(/^([a-zA-Z0-9_./-]+)\/\s*$/);
    if (headerMatch) {
      root = headerMatch[1];
      stack.length = 0;
      continue;
    }

    // Tree line: leading spaces + (│   )* + (├──|└──) + name[/] + optional comment
    const m = raw.match(
      /^([ │]*)(?:├──|└──)\s+([A-Za-z0-9_.-]+)(\/?)/,
    );
    if (!m) continue;
    const indent = m[1];
    const name = m[2];
    const isDir = m[3] === "/";
    // Each level = 4 columns ("│   " or "    ").
    const depth = Math.floor(indent.length / 4);
    stack.length = depth;
    stack.push(name);
    const full = `${root}/${stack.join("/")}`;
    if (!isDir) paths.push(full);
    // Directories are not asserted — only leaf files.
  }
  return paths;
}

function checkFilePaths() {
  const md = readText("docs/filesExplainer.md");
  const blocks = fencedBlocks(md);
  // We expect the Frontend / Edge Functions / Scripts trees as fenced blocks.
  // Each block's first non-empty line is the root (e.g. "src/").
  const allPaths: string[] = [];
  for (const block of blocks) {
    const firstLine = block.split("\n").find((l) => l.trim().length) ?? "";
    const rootMatch = firstLine.match(/^([a-zA-Z0-9_./-]+)\/\s*$/);
    if (!rootMatch) continue; // not a tree block
    allPaths.push(...extractTreePaths(block, rootMatch[1]));
  }

  // Exempt entries that document conceptual groupings, not real leaf files.
  const EXEMPT = new Set<string>([
    "src/test", // documented as a folder summary, listed as a leaf
    "src/lib/__tests__",
    "src/components/__tests__",
    "src/integrations/supabase",
  ]);

  let missing = 0;
  for (const p of allPaths) {
    if (EXEMPT.has(p)) continue;
    // Edge-function entries are documented as `predictNextCards/` etc.
    // (directories). The tree parser already skips those. For functions
    // documented without a trailing `/` (e.g. "_shared/logger.ts"), we
    // assert the file directly.
    if (!existsSync(join(ROOT, p))) {
      fail(`docs/filesExplainer.md references missing path: ${p}`);
      missing++;
    }
  }
  console.log(
    `File-path check: ${allPaths.length} entries scanned, ${missing} missing.`,
  );
}

// ---------- 2. table check ----------

function listMigrationTables(): Set<string> {
  const dir = join(ROOT, "supabase/migrations");
  const out = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  } catch {
    return out;
  }
  const re =
    /create\s+(?:table|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) out.add(m[1].toLowerCase());
  }
  return out;
}

function checkTables() {
  const md = readText("docs/filesExplainer.md");
  // Find the first markdown table (the "Database" one).
  const tableMatch = md.match(/\n(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n)+)/);
  if (!tableMatch) {
    fail("docs/filesExplainer.md is missing the Database table.");
    return;
  }
  const rows = tableMatch[1]
    .split("\n")
    .slice(2) // drop header + separator
    .filter((r) => r.trim().startsWith("|"));

  const docTables = new Set<string>();
  for (const row of rows) {
    const firstCol = row.split("|")[1] ?? "";
    // Pull every backticked identifier — supports "scenes / scene_cards".
    const ids = [...firstCol.matchAll(/`([a-z_][a-z0-9_]*)`/g)].map((m) =>
      m[1].toLowerCase(),
    );
    for (const id of ids) docTables.add(id);
  }

  const real = listMigrationTables();
  let missing = 0;
  for (const t of docTables) {
    if (!real.has(t)) {
      fail(
        `docs/filesExplainer.md lists table \`${t}\` but no CREATE TABLE/VIEW exists in supabase/migrations/.`,
      );
      missing++;
    }
  }

  // Optional reverse check: real tables not mentioned in docs. Warning only
  // (we don't want to require every internal helper table in user-facing docs),
  // but emit so reviewers see drift.
  for (const t of real) {
    if (!docTables.has(t)) {
      console.log(
        `::warning::Table ${t} exists in migrations but is not documented in docs/filesExplainer.md.`,
      );
    }
  }
  console.log(
    `Table check: ${docTables.size} documented, ${real.size} in migrations, ${missing} missing.`,
  );
}

// ---------- 3. CI-job check ----------

function checkCiJobs() {
  const md = readText("docs/security-ci.md");
  const wf = readText(".github/workflows/security.yml");

  // Extract jobs table — first markdown table in the doc.
  const tableMatch = md.match(/\n(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n)+)/);
  if (!tableMatch) {
    fail("docs/security-ci.md is missing the jobs table.");
    return;
  }
  const rows = tableMatch[1]
    .split("\n")
    .slice(2)
    .filter((r) => r.trim().startsWith("|"));

  const docJobs = new Set<string>();
  for (const row of rows) {
    const firstCol = (row.split("|")[1] ?? "").trim();
    const id = firstCol.replace(/`/g, "").trim();
    if (id) docJobs.add(id);
  }

  // Extract job keys from the workflow file. They appear under `jobs:` as
  // top-level keys with two-space indentation.
  const jobsIdx = wf.indexOf("\njobs:");
  const jobsBlock = jobsIdx >= 0 ? wf.slice(jobsIdx) : "";
  const realJobs = new Set<string>();
  for (const line of jobsBlock.split("\n")) {
    const m = line.match(/^ {2}([a-z0-9_-]+):\s*$/i);
    if (m) realJobs.add(m[1]);
  }

  let missing = 0;
  for (const j of docJobs) {
    if (!realJobs.has(j)) {
      fail(
        `docs/security-ci.md documents CI job \`${j}\` but it is not defined in .github/workflows/security.yml.`,
      );
      missing++;
    }
  }
  for (const j of realJobs) {
    if (!docJobs.has(j)) {
      console.log(
        `::warning::Workflow job ${j} is defined but not documented in docs/security-ci.md.`,
      );
    }
  }
  console.log(
    `CI-job check: ${docJobs.size} documented, ${realJobs.size} in workflow, ${missing} missing.`,
  );
}

// ---------- run ----------

checkFilePaths();
checkTables();
checkCiJobs();

if (failures.length) {
  for (const f of failures) console.log(`::error::${f}`);
  console.error(
    `\nDocs-freshness check failed with ${failures.length} issue(s).`,
  );
  process.exit(1);
}
console.log("Docs-freshness check passed.");
