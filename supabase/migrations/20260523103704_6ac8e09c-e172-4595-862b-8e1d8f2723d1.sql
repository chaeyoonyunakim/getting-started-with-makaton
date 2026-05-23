CREATE OR REPLACE FUNCTION public.enforce_scene_card_position_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.position IS DISTINCT FROM OLD.position THEN
    RAISE EXCEPTION 'scene_cards.position is immutable: cards may be appended or removed but never re-ordered'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_scene_card_position_immutable() FROM anon, authenticated, public;