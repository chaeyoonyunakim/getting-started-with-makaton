// Shared org-membership guard for AI-billing edge functions.
// Rejects callers that are not assigned to a real organisation
// (org_id NULL or the seeded "Default Org" sentinel) to prevent
// self-registered accounts from draining paid AI credits.

const DEFAULT_ORG_SENTINEL = "00000000-0000-0000-0000-000000000001";

// deno-lint-ignore no-explicit-any
export async function requireOrgMember(supabase: any, userId: string): Promise<
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

  const orgId = data?.org_id as string | null | undefined;
  if (!orgId || orgId === DEFAULT_ORG_SENTINEL) {
    return {
      ok: false,
      status: 403,
      body: { error: "Account is not a member of an authorised organisation." },
    };
  }

  return { ok: true, orgId };
}
