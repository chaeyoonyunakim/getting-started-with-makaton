// Shared org-membership guard for AI-billing edge functions.
// Rejects callers that are not assigned to a real organisation
// (org_id NULL or the seeded "Default Org" sentinel) to prevent
// self-registered accounts from draining paid AI credits.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DEFAULT_ORG_SENTINEL = "00000000-0000-0000-0000-000000000001";

export async function requireOrgMember(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  { ok: true; orgId: string } | { ok: false; status: number; body: Record<string, unknown> }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("requireOrgMember profile lookup failed", error);
    return { ok: false, status: 500, body: { error: "Profile lookup failed" } };
  }

  const orgId = (data as { org_id?: string | null } | null)?.org_id;
  if (!orgId || orgId === DEFAULT_ORG_SENTINEL) {
    return {
      ok: false,
      status: 403,
      body: { error: "Account is not a member of an authorised organisation." },
    };
  }

  return { ok: true, orgId };
}
