// GDPR Right-to-Erasure. Hard-deletes one pupil and all dependent rows.
// ON DELETE CASCADE handles sessions, card_selections, predictions_log,
// pupil_scene_overrides, ta_notifications. SENCo-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { pupilId } = (await req.json()) as { pupilId?: string };
    if (!pupilId) {
      return new Response(JSON.stringify({ error: "pupilId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "no user" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isSenco } = await client.rpc("has_role", { _user_id: user.id, _role: "senco" });
    if (!isSenco) {
      return new Response(JSON.stringify({ error: "senco role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error } = await client.from("pupils").delete().eq("id", pupilId);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deletePupil", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
