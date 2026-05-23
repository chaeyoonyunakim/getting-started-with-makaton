// Next-card personalisation engine.
// All compute stays inside the project's Supabase region — no external LLMs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const HALF_LIFE_DAYS = 14;
const SATURATION = 50;

type Json = Record<string, unknown>;

interface Body {
  pupilId: string;
  sceneId: string;
  currentCardId: string | null;
  sessionId: string;
}

function decay(daysAgo: number) {
  return Math.pow(0.5, daysAgo / HALF_LIFE_DAYS);
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
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
    if (!isUuid(body.pupilId) || !isUuid(body.sceneId) || !isUuid(body.sessionId)) {
      return new Response(JSON.stringify({ error: "invalid uuid in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.currentCardId !== null && !isUuid(body.currentCardId)) {
      return new Response(JSON.stringify({ error: "currentCardId must be uuid or null" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { pupilId, sceneId, currentCardId, sessionId } = body as Body;

    // Caller-scoped client for RLS-checked writes.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    // Service client for the materialised view (revoked from API roles).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Org check via RLS — make sure the caller can see this pupil.
    const { data: pupil, error: pupilErr } = await userClient
      .from("pupils")
      .select("id, org_id, display_name")
      .eq("id", pupilId)
      .maybeSingle();
    if (pupilErr || !pupil) {
      return new Response(JSON.stringify({ error: "pupil not visible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Visible cards for the scene.
    const { data: sceneCards } = await userClient
      .from("scene_cards")
      .select("card_id, position, cards(id, label)")
      .eq("scene_id", sceneId)
      .order("position");
    const visibleIds = (sceneCards ?? []).map((r: Json) => r.card_id as string);
    const labelByCard: Record<string, string> = {};
    for (const row of (sceneCards ?? []) as any[]) {
      if (row.cards) labelByCard[row.card_id] = row.cards.label;
    }
    if (visibleIds.length === 0) {
      return new Response(JSON.stringify({ top3: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Transitions (via admin client — MV is private).
    const { data: transitions } = await adminClient
      .from("mv_pupil_transitions")
      .select("from_card_id, to_card_id, count, last_seen_at")
      .eq("pupil_id", pupilId)
      .eq("scene_id", sceneId);

    const now = Date.now();
    const decayed: Record<string, number> = {};
    for (const id of visibleIds) decayed[id] = 0;
    for (const t of (transitions ?? []) as any[]) {
      if ((t.from_card_id ?? null) !== (currentCardId ?? null)) continue;
      if (!visibleIds.includes(t.to_card_id)) continue;
      const days = (now - new Date(t.last_seen_at).getTime()) / 86_400_000;
      decayed[t.to_card_id] += Number(t.count) * decay(Math.max(0, days));
    }
    const k = visibleIds.length;
    const mTotal = visibleIds.reduce((s, id) => s + decayed[id] + 1, 0);
    const markov: Record<string, number> = {};
    for (const id of visibleIds) markov[id] = (decayed[id] + 1) / mTotal;

    // 4. Bandit prior.
    const { data: arms } = await userClient
      .from("bandit_arms")
      .select("card_id, alpha, beta")
      .eq("scene_id", sceneId);
    const armById = new Map((arms ?? []).map((a: any) => [a.card_id, a]));
    const banditMeans: Record<string, number> = {};
    let bSum = 0;
    for (const id of visibleIds) {
      const a = armById.get(id);
      const alpha = a?.alpha ?? 1;
      const beta = a?.beta ?? 1;
      const m = alpha / (alpha + beta);
      banditMeans[id] = m;
      bSum += m;
    }
    const bandit: Record<string, number> = {};
    for (const id of visibleIds) bandit[id] = bSum > 0 ? banditMeans[id] / bSum : 1 / visibleIds.length;

    // 5. Blend.
    const { count: nSelections } = await userClient
      .from("card_selections")
      .select("id", { count: "exact", head: true })
      .eq("pupil_id", pupilId)
      .eq("scene_id", sceneId);
    const w = Math.min(1, (nSelections ?? 0) / SATURATION);

    const final: Record<string, number> = {};
    for (const id of visibleIds) final[id] = w * markov[id] + (1 - w) * bandit[id];

    const fromLabel = currentCardId ? labelByCard[currentCardId] : undefined;
    const top3 = Object.entries(final)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cardId, probability]) => {
        const personalWeight = w * (markov[cardId] ?? 0);
        const globalWeight = (1 - w) * (bandit[cardId] ?? 0);
        let reason: string;
        if (personalWeight > globalWeight && fromLabel) {
          reason = `Frequently chosen after '${fromLabel}'`;
        } else if (personalWeight > globalWeight) {
          reason = `A regular choice for ${pupil.display_name}`;
        } else {
          reason = `Popular among pupils with similar profile`;
        }
        return { cardId, probability, reason };
      });

    // 6. Persist prediction.
    await userClient.from("predictions_log").insert({
      pupil_id: pupilId,
      scene_id: sceneId,
      current_card_id: currentCardId,
      session_id: sessionId,
      top3,
    });

    return new Response(JSON.stringify({ top3, w }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predictNextCards error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
