/**
 * RLS regression tests for pupil deletion.
 *
 * 1. Static test (always runs): replays every supabase/migrations/*.sql file,
 *    reconstructs the live DELETE policy on public.pupils, and asserts that
 *    it requires `has_role(..., 'senco')` AND `current_user_org()`. This
 *    catches any future migration that loosens the guard.
 *
 * 2. Integration test (opt-in): if SUPABASE_URL + SUPABASE_TEST_SENCO_EMAIL/
 *    PASSWORD + SUPABASE_TEST_TA_EMAIL/PASSWORD + SUPABASE_TEST_PUPIL_ID env
 *    vars are present, signs in as each user against the live project and
 *    verifies that a TA's DELETE silently affects 0 rows (RLS filter) while
 *    a SENCO's DELETE on the same pupil succeeds. Skipped otherwise so
 *    local/CI runs without secrets stay green.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------- shared SQL helpers (mirror scripts/check-rls-regression.ts) ----------

type Policy = { schema: string; table: string; command: string; name: string; body: string };

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    if (sql.slice(i, i + 2) === "$$") {
      inDollar = !inDollar;
      buf += "$$";
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

function qualify(name: string): { schema: string; table: string } {
  const parts = name.replace(/"/g, "").split(".");
  return parts.length === 2
    ? { schema: parts[0], table: parts[1] }
    : { schema: "public", table: parts[0] };
}

function commandFrom(body: string): string {
  const m = body.match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i);
  return (m ? m[1] : "ALL").toUpperCase();
}

function replayPolicies(): Map<string, Policy> {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const sql = stripComments(
    files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n"),
  );

  const createRe =
    /^CREATE\s+POLICY\s+(?:"([^"]+)"|(\S+))\s+ON\s+([A-Za-z0-9_."]+)\s+([\s\S]+)$/i;
  const dropRe =
    /^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|(\S+))\s+ON\s+([A-Za-z0-9_."]+)/i;

  const policies = new Map<string, Policy>();
  for (const stmt of splitStatements(sql)) {
    const upper = stmt.toUpperCase();
    if (upper.startsWith("CREATE POLICY")) {
      const m = stmt.match(createRe);
      if (!m) continue;
      const name = m[1] ?? m[2];
      const { schema, table } = qualify(m[3]);
      const body = m[4];
      const command = commandFrom(body);
      policies.set(`${schema}.${table}|${command}|${name}`, {
        schema,
        table,
        command,
        name,
        body: `CREATE POLICY "${name}" ON ${schema}.${table} ${body}`,
      });
    } else if (upper.startsWith("DROP POLICY")) {
      const m = stmt.match(dropRe);
      if (!m) continue;
      const name = m[1] ?? m[2];
      const { schema, table } = qualify(m[3]);
      for (const cmd of ["ALL", "SELECT", "INSERT", "UPDATE", "DELETE"]) {
        policies.delete(`${schema}.${table}|${cmd}|${name}`);
      }
    }
  }
  return policies;
}

// ---------- Static policy test (always runs) ----------

describe("public.pupils DELETE RLS", () => {
  it("restricts deletion to SENCOs in the caller's org", () => {
    const policies = replayPolicies();
    const matches = [...policies.values()].filter(
      (p) =>
        p.schema === "public" &&
        p.table === "pupils" &&
        (p.command === "DELETE" || p.command === "ALL"),
    );

    expect(
      matches.length,
      "expected at least one DELETE/ALL policy on public.pupils",
    ).toBeGreaterThan(0);

    const guarded = matches.find(
      (p) =>
        p.body.includes("has_role(") &&
        p.body.includes("'senco'") &&
        p.body.includes("current_user_org()"),
    );

    expect(
      guarded,
      `No surviving DELETE policy on public.pupils enforces has_role(..., 'senco') AND current_user_org(). ` +
        `Surviving policies: ${matches.map((m) => m.name).join(", ")}`,
    ).toBeDefined();

    for (const m of matches) {
      expect(
        /USING\s*\(\s*true\s*\)/i.test(m.body),
        `Policy "${m.name}" uses USING (true) — pupil deletion must stay scoped.`,
      ).toBe(false);
    }
  });
});

// ---------- Live integration test (opt-in via env) ----------

const live = {
  url: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  anon: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  sencoEmail: process.env.SUPABASE_TEST_SENCO_EMAIL,
  sencoPassword: process.env.SUPABASE_TEST_SENCO_PASSWORD,
  taEmail: process.env.SUPABASE_TEST_TA_EMAIL,
  taPassword: process.env.SUPABASE_TEST_TA_PASSWORD,
  pupilId: process.env.SUPABASE_TEST_PUPIL_ID,
};

const liveReady =
  !!live.url &&
  !!live.anon &&
  !!live.sencoEmail &&
  !!live.sencoPassword &&
  !!live.taEmail &&
  !!live.taPassword &&
  !!live.pupilId;

describe.skipIf(!liveReady)("public.pupils DELETE RLS (live)", () => {
  it("blocks a TA from deleting a pupil but allows a SENCO", async () => {
    // TA: DELETE should match zero rows under RLS (no error, no row removed).
    const taClient = createClient(live.url!, live.anon!, {
      auth: { persistSession: false },
    });
    const taAuth = await taClient.auth.signInWithPassword({
      email: live.taEmail!,
      password: live.taPassword!,
    });
    expect(taAuth.error, "TA sign-in failed").toBeNull();

    const taDelete = await taClient
      .from("pupils")
      .delete()
      .eq("id", live.pupilId!)
      .select("id");
    // RLS returns no rows for unauthorized callers; PostgREST surfaces this
    // either as an explicit 403 (when policy denies) or as an empty array.
    if (taDelete.error) {
      expect(taDelete.error.code === "42501" || taDelete.error.code === "PGRST301").toBe(true);
    } else {
      expect(taDelete.data ?? []).toHaveLength(0);
    }

    // Pupil must still exist.
    const stillThere = await taClient
      .from("pupils")
      .select("id")
      .eq("id", live.pupilId!)
      .maybeSingle();
    expect(stillThere.data?.id).toBe(live.pupilId);

    // SENCO: DELETE should succeed and return the row.
    const sencoClient = createClient(live.url!, live.anon!, {
      auth: { persistSession: false },
    });
    const sencoAuth = await sencoClient.auth.signInWithPassword({
      email: live.sencoEmail!,
      password: live.sencoPassword!,
    });
    expect(sencoAuth.error, "SENCO sign-in failed").toBeNull();

    const sencoDelete = await sencoClient
      .from("pupils")
      .delete()
      .eq("id", live.pupilId!)
      .select("id");
    expect(sencoDelete.error).toBeNull();
    expect(sencoDelete.data?.map((r) => r.id)).toContain(live.pupilId);
  }, 30_000);
});
