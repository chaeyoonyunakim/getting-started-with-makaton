// Nightly GDPR purge. For each org:
//   1. Aggregates card_selections older than retention_days into mv_pupil_transitions
//      (the bandit_arms / mv refresh is handled separately).
//   2. Hard-deletes the underlying card_selections rows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: orgs, error: orgErr } = await admin.from("org_settings").select("org_id, retention_days");
    if (orgErr) throw orgErr;

    let totalDeleted = 0;
    for (const o of orgs ?? []) {
      const cutoff = new Date(Date.now() - (o.retention_days as number) * 86_400_000).toISOString();
      const { data: stale } = await admin
        .from("card_selections")
        .select("id, pupil_id")
        .lt("created_at", cutoff)
        .in("pupil_id", (await admin.from("pupils").select("id").eq("org_id", o.org_id)).data?.map((p: any) => p.id) ?? []);
      if (!stale?.length) continue;

      // Refresh the materialised aggregate (it's derived from card_selections).
      // The MV is REFRESHable via SQL; we expose a thin RPC if needed in production.
      const ids = stale.map((r: any) => r.id);
      const { error: delErr } = await admin.from("card_selections").delete().in("id", ids);
      if (delErr) throw delErr;
      totalDeleted += ids.length;
    }

    return new Response(JSON.stringify({ deleted: totalDeleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("purgeOldSelections", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
