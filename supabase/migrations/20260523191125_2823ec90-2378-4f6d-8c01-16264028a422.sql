DROP POLICY IF EXISTS "Org members delete pupils" ON public.pupils;
CREATE POLICY "Sencos delete pupils"
  ON public.pupils FOR DELETE
  TO authenticated
  USING (org_id = public.current_user_org()
    AND public.has_role(auth.uid(), 'senco'));