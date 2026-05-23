
-- 1. Prevent role self-escalation on profiles
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Only existing SENCOs (or service_role bypassing RLS) may change a role.
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'senco'::app_role) THEN
      RAISE EXCEPTION 'Insufficient privileges to change role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 2. Restrict bandit_arms SELECT to org members (via scene join)
DROP POLICY IF EXISTS "Authenticated view bandit_arms" ON public.bandit_arms;
CREATE POLICY "Org members view bandit_arms"
ON public.bandit_arms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scenes s
    WHERE s.id = bandit_arms.scene_id
      AND s.org_id = current_user_org()
  )
);

-- 3. Restrict card_modifiers SELECT to org members (via scene_cards → scenes join)
DROP POLICY IF EXISTS "Authenticated view card_modifiers" ON public.card_modifiers;
CREATE POLICY "Org members view card_modifiers"
ON public.card_modifiers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scene_cards sc
    JOIN public.scenes s ON s.id = sc.scene_id
    WHERE sc.card_id = card_modifiers.card_id
      AND s.org_id = current_user_org()
  )
);

-- 4. Lock down symbol-cache bucket writes: only service_role may insert/update/delete.
-- Public read remains intentional (CC-licensed ARASAAC/Mulberry symbols, served as CDN cache).
DROP POLICY IF EXISTS "Authenticated upload symbol cache" ON storage.objects;
DROP POLICY IF EXISTS "symbol-cache insert" ON storage.objects;
DROP POLICY IF EXISTS "symbol-cache update" ON storage.objects;
DROP POLICY IF EXISTS "symbol-cache delete" ON storage.objects;

CREATE POLICY "symbol-cache writes service role only - insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'symbol-cache' AND false);

CREATE POLICY "symbol-cache writes service role only - update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'symbol-cache' AND false);

CREATE POLICY "symbol-cache writes service role only - delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'symbol-cache' AND false);
