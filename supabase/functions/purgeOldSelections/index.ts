// Nightly GDPR purge. For each org:
//   1. Hard-deletes card_selections older than retention_days.
//   2. Aggregated counts in mv_pupil_transitions are refreshed by updateBanditNightly.
// Auth: requires a pre-shared CRON_SECRET header. Intended for pg_cron / scheduler use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require shared cron secret OR a SENCO JWT.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization");
  let authorised = false;
  let callerOrgId: string | null = null;
  let scopedToCallerOrg = false;

  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    authorised = true;
  } else if (authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (claims?.claims?.sub) {
      const { data: isSenco } = await userClient.rpc("has_role", {
        _user_id: claims.claims.sub,
        _role: "senco",
      });
      if (isSenco === true) {
        const { data: profile } = await userClient
          .from("profiles")
          .select("org_id")
          .eq("id", claims.claims.sub)
          .maybeSingle();
        if (profile?.org_id) {
          authorised = true;
          scopedToCallerOrg = true;
          callerOrgId = profile.org_id as string;
        }
      }
    }
  }

  if (!authorised) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const orgQuery = admin.from("org_settings").select("org_id, retention_days");
    if (scopedToCallerOrg && callerOrgId) {
      orgQuery.eq("org_id", callerOrgId);
    }
    const { data: orgs, error: orgErr } = await orgQuery;
    if (orgErr) throw orgErr;

    let totalDeleted = 0;
    for (const o of orgs ?? []) {
      const days = o.retention_days as number;
      if (!days || days <= 0) continue;
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data: pupils } = await admin
        .from("pupils")
        .select("id")
        .eq("org_id", o.org_id);
      const pupilIds = (pupils ?? []).map((p: { id: string }) => p.id);
      if (pupilIds.length === 0) continue;
      const { data: stale } = await admin
        .from("card_selections")
        .select("id")
        .lt("created_at", cutoff)
        .in("pupil_id", pupilIds);
      if (!stale?.length) continue;
      const ids = stale.map((r: { id: string }) => r.id);
      const { error: delErr } = await admin.from("card_selections").delete().in("id", ids);
      if (delErr) throw delErr;
      totalDeleted += ids.length;
    }

    return new Response(JSON.stringify({ deleted: totalDeleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("purgeOldSelections", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
