// In-app TA notifier. Replaces the previous Slack webhook integration —
// selection data never leaves the project's Supabase region.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  child_name?: string;
  selection: string;
  rationale?: string;
  pupil_id?: string | null;
  session_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = (await req.json()) as Partial<Body>;
    const selection = (body.selection ?? "").toString().slice(0, 200).trim();
    if (!selection) {
      return new Response(JSON.stringify({ error: "selection required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: profile } = await client.from("profiles").select("org_id").maybeSingle();
    const orgId = profile?.org_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "no org" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const child_name = ((body.child_name ?? "Pupil").toString().slice(0, 100).trim()) || "Pupil";
    const rationale = body.rationale ? body.rationale.toString().slice(0, 500).trim() || null : null;
    const { data, error } = await client
      .from("ta_notifications")
      .insert({
        org_id: orgId,
        pupil_id: body.pupil_id ?? null,
        session_id: body.session_id ?? null,
        child_name,
        selection,
        rationale,
      })
      .select("id")
      .single();
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("makaton-notifier", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
