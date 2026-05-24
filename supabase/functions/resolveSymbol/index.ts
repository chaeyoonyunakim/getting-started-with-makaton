// Licence-aware symbol resolver.
// Order: org overlay (if licensed) -> ARASAAC -> Mulberry CDN -> Sclera (HC only) -> AI (flag) -> null
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sanitizePromptInput } from "../_shared/sanitizePromptInput.ts";
import { requireOrgMember } from "../_shared/requireOrgMember.ts";

const ARASAAC_ATTR =
  "Symbols author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). Licence: CC BY-NC-SA";
const MULBERRY_ATTR =
  "Mulberry Symbols by Garry Paxton. Licence: CC BY-SA 2.0 UK";
const SCLERA_ATTR =
  "Sclera Symbols (https://www.sclera.be). Licence: CC BY-NC";

interface Body {
  label: string;
  preferredTheme?: "default" | "high-contrast";
  pupilId?: string | null;
}

type Resolved = {
  url: string;
  source: "arasaac" | "mulberry" | "sclera" | "ai" | "manual" | "makaton";
  licence: string;
  attribution: string;
} | null;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

async function tryOrgPack(admin: ReturnType<typeof createClient>, orgId: string, label: string): Promise<Resolved> {
  const { data } = await admin
    .from("org_symbol_packs")
    .select("image_url, attribution")
    .eq("org_id", orgId)
    .ilike("label", label)
    .maybeSingle();
  if (!data) return null;
  return {
    url: data.image_url as string,
    source: "makaton",
    licence: "school-licensed",
    attribution: (data.attribution as string) ?? "Licensed Makaton symbol",
  };
}

async function cacheToStorage(
  admin: ReturnType<typeof createClient>,
  key: string,
  blob: Blob,
  contentType: string,
): Promise<string | null> {
  const { error } = await admin.storage.from("symbol-cache").upload(key, blob, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.warn("storage upload failed", error.message);
    return null;
  }
  const { data } = admin.storage.from("symbol-cache").getPublicUrl(key);
  return data.publicUrl;
}

async function tryArasaac(admin: ReturnType<typeof createClient>, label: string): Promise<Resolved> {
  try {
    const search = await fetch(
      `https://api.arasaac.org/api/pictograms/en/search/${encodeURIComponent(label)}`,
    );
    if (!search.ok) return null;
    const results = (await search.json()) as Array<{ _id: number }>;
    if (!results?.length) return null;
    const id = results[0]._id;
    const cacheKey = `arasaac/${id}.png`;
    // Probe cache first
    const existing = admin.storage.from("symbol-cache").getPublicUrl(cacheKey);
    const head = await fetch(existing.data.publicUrl, { method: "HEAD" });
    if (head.ok) {
      return { url: existing.data.publicUrl, source: "arasaac", licence: "CC BY-NC-SA", attribution: ARASAAC_ATTR };
    }
    const img = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_500.png`);
    if (!img.ok) return null;
    const blob = await img.blob();
    const url = await cacheToStorage(admin, cacheKey, blob, "image/png");
    if (!url) return null;
    return { url, source: "arasaac", licence: "CC BY-NC-SA", attribution: ARASAAC_ATTR };
  } catch (e) {
    console.warn("arasaac fail", e);
    return null;
  }
}

async function tryMulberry(admin: ReturnType<typeof createClient>, label: string): Promise<Resolved> {
  const slug = slugify(label);
  const cdn = `https://cdn.jsdelivr.net/gh/straight-street/mulberry-symbols@master/EN-symbols/${slug}.svg`;
  try {
    const r = await fetch(cdn);
    if (!r.ok) return null;
    const cacheKey = `mulberry/${slug}.svg`;
    const blob = await r.blob();
    const url = await cacheToStorage(admin, cacheKey, blob, "image/svg+xml");
    return { url: url ?? cdn, source: "mulberry", licence: "CC BY-SA 2.0 UK", attribution: MULBERRY_ATTR };
  } catch {
    return null;
  }
}

async function trySclera(admin: ReturnType<typeof createClient>, label: string): Promise<Resolved> {
  const slug = slugify(label);
  const cdn = `https://cdn.jsdelivr.net/gh/openboardformat/sclera-symbols@master/symbols/${slug}.png`;
  try {
    const r = await fetch(cdn, { method: "HEAD" });
    if (!r.ok) return null;
    return { url: cdn, source: "sclera", licence: "CC BY-NC", attribution: SCLERA_ATTR };
  } catch {
    return null;
  }
}

async function tryAi(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  label: string,
): Promise<Resolved> {
  if (Deno.env.get("ENABLE_AI_SYMBOLS") !== "true") return null;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const safeLabel = sanitizePromptInput(label, { maxLength: 80, fallback: "symbol" });
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: `Generate a single high-contrast line-art symbol on solid white background representing: ${safeLabel}` }],
        modalities: ["image", "text"],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const dataUrl: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:image/")) return null;
    const [, mime = "image/png", b64 = ""] = dataUrl.match(/^data:([^;]+);base64,(.+)$/) ?? [];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = mime === "image/png" ? "png" : "webp";
    const cacheKey = `ai/${orgId}/${slugify(label)}-${crypto.randomUUID()}.${ext}`;
    const url = await cacheToStorage(admin, cacheKey, new Blob([bytes], { type: mime }), mime);
    if (!url) return null;
    await admin.from("symbol_review_queue").insert({
      org_id: orgId,
      label,
      candidate_url: url,
      source: "ai",
      state: "pending",
    });
    return { url, source: "ai", licence: "internal-review", attribution: "AI-generated, pending SENCo review" };
  } catch (e) {
    console.warn("ai fail", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      auth.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const orgCheck = await requireOrgMember(userClient, claims.claims.sub as string);
    if (!orgCheck.ok) {
      return new Response(JSON.stringify(orgCheck.body), { status: orgCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = (await req.json()) as Partial<Body>;
    const label = (body.label ?? "").toString().slice(0, 80).trim();
    if (!label) {
      return new Response(JSON.stringify({ error: "label required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const preferredTheme = body.preferredTheme ?? "default";


    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Determine org + makaton_licensed
    let orgId: string | null = null;
    let licensed = false;
    if (body.pupilId) {
      const { data: pupil } = await userClient
        .from("pupils")
        .select("org_id, makaton_licensed")
        .eq("id", body.pupilId)
        .maybeSingle();
      if (pupil) {
        orgId = pupil.org_id as string;
        licensed = !!pupil.makaton_licensed;
      }
    }
    if (!orgId) {
      const { data: profile } = await userClient
        .from("profiles")
        .select("org_id")
        .maybeSingle();
      orgId = (profile?.org_id as string) ?? null;
    }

    let resolved: Resolved = null;
    if (orgId && licensed) resolved = await tryOrgPack(admin, orgId, label);
    if (!resolved) resolved = await tryArasaac(admin, label);
    if (!resolved) resolved = await tryMulberry(admin, label);
    if (!resolved && preferredTheme === "high-contrast") resolved = await trySclera(admin, label);
    if (!resolved && orgId) resolved = await tryAi(admin, orgId, label);

    return new Response(JSON.stringify({ resolved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolveSymbol error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
