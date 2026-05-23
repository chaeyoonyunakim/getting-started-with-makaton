
-- 1. Replace profiles UPDATE policy with WITH CHECK preventing role change
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- 2. Remove overly permissive authenticated write on symbol-cache bucket
DROP POLICY IF EXISTS "Authenticated write symbol cache" ON storage.objects;

-- 3. Lock down SECURITY DEFINER helper functions: revoke from anon/authenticated/public
REVOKE EXECUTE ON FUNCTION public.current_user_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
-- RLS policies invoke these as the policy owner; service_role retains access for edge functions.
GRANT EXECUTE ON FUNCTION public.current_user_org() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role, authenticated;
-- Note: has_role is referenced by RLS policies via SQL; keep authenticated EXECUTE so policies evaluate.
