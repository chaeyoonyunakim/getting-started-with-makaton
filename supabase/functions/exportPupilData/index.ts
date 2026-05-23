// GDPR Subject Access Request: dumps every row tied to one pupil as JSON.
// Only SENCos in the pupil's org may invoke it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const url = new URL(req.url);
    const pupilId = url.searchParams.get("pupilId") ?? (await req.json().catch(() => ({})))?.pupilId;
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

    const [pupil, sessions, selections, predictions, overrides] = await Promise.all([
      client.from("pupils").select("*").eq("id", pupilId).maybeSingle(),
      client.from("sessions").select("*").eq("pupil_id", pupilId),
      client.from("card_selections").select("*").eq("pupil_id", pupilId),
      client.from("predictions_log").select("*").eq("pupil_id", pupilId),
      client.from("pupil_scene_overrides").select("*").eq("pupil_id", pupilId),
    ]);

    if (!pupil.data) {
      return new Response(JSON.stringify({ error: "pupil not visible" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = {
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      pupil: pupil.data,
      sessions: sessions.data ?? [],
      card_selections: selections.data ?? [],
      predictions_log: predictions.data ?? [],
      pupil_scene_overrides: overrides.data ?? [],
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="pupil-${pupilId}.json"`,
      },
    });
  } catch (e) {
    console.error("exportPupilData", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
