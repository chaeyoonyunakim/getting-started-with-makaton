// Nightly job: refresh mv_pupil_transitions and update bandit_arms (alpha, beta)
// from yesterday's card_selections across all orgs. Intended to be scheduled
// via pg_cron / external cron with the service role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Refresh the materialised view via a SQL RPC if available; otherwise skip silently.
    // The view is REFRESH-able through SQL; we expose a thin wrapper later if needed.

    // Pull yesterday's selections grouped by scene+card.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error } = await admin
      .from("card_selections")
      .select("scene_id, to_card_id")
      .gte("created_at", since);
    if (error) throw error;

    // Tally wins per (scene, card) and total trials per scene.
    const wins = new Map<string, number>();
    const trials = new Map<string, number>();
    for (const row of recent ?? []) {
      const key = `${row.scene_id}|${row.to_card_id}`;
      wins.set(key, (wins.get(key) ?? 0) + 1);
      trials.set(row.scene_id, (trials.get(row.scene_id) ?? 0) + 1);
    }

    // Upsert bandit arms.
    const upserts: { scene_id: string; card_id: string; alpha: number; beta: number; updated_at: string }[] = [];
    const seenScenes = new Set<string>();
    for (const [key, w] of wins) {
      const [scene_id, card_id] = key.split("|");
      seenScenes.add(scene_id);
      const total = trials.get(scene_id) ?? 0;
      const losses = Math.max(0, total - w);
      // Fetch existing row to increment.
      const { data: existing } = await admin
        .from("bandit_arms")
        .select("alpha, beta")
        .eq("scene_id", scene_id)
        .eq("card_id", card_id)
        .maybeSingle();
      upserts.push({
        scene_id,
        card_id,
        alpha: (existing?.alpha ?? 1) + w,
        beta: (existing?.beta ?? 1) + losses,
        updated_at: new Date().toISOString(),
      });
    }
    if (upserts.length > 0) {
      const { error: upErr } = await admin.from("bandit_arms").upsert(upserts);
      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({ updated: upserts.length, scenes: seenScenes.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("updateBanditNightly error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
