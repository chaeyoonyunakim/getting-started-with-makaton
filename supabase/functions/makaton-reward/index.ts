import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sanitizePromptInput } from "../_shared/sanitizePromptInput.ts";
import { requireOrgMember } from "../_shared/requireOrgMember.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgCheck = await requireOrgMember(supabase, claims.claims.sub as string);
  if (!orgCheck.ok) {
    return new Response(JSON.stringify(orgCheck.body), {
      status: orgCheck.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "Server config error: missing API key" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { makatonId, assetUrl, label, color } = await req.json();

    if (!makatonId) {
      return new Response(JSON.stringify({ error: "Missing makatonId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strict validation to prevent prompt injection
    const idNum = Number(makatonId);
    const safeMakatonId = Number.isInteger(idNum) && idNum >= 0 && idNum < 1_000_000 ? idNum : 0;
    const ALLOWED_URL_PREFIXES = [
      "https://www.makatonassetbank.co.uk/",
      "https://makatonassetbank.co.uk/",
      "https://api.arasaac.org/",
      "https://static.arasaac.org/",
      "https://mulberrysymbols.org/",
    ];
    const safeAssetUrl =
      typeof assetUrl === "string" &&
      assetUrl.length < 300 &&
      ALLOWED_URL_PREFIXES.some((p) => assetUrl.startsWith(p))
        ? assetUrl
        : "N/A";
    const safeLabel = sanitizePromptInput(label, { maxLength: 80, fallback: "unknown" });
    const safeColor = sanitizePromptInput(color, { maxLength: 40, fallback: "Electric Blue" });
    const prompt = `You are given a Makaton sign diagram reference for "${safeLabel}" (Makaton Asset Bank ID: ${safeMakatonId}, URL: ${safeAssetUrl}). Generate a version of this Makaton sign where the black lines are changed to a vibrant ${safeColor} and add a soft glowing background. Keep the technical integrity of the sign perfect — do NOT change the shape, line weight, or characters.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ image: imageUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("makaton-reward error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
