-- Scenes (per org)
CREATE TABLE public.scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  icon_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);

-- Scene <-> Card join with position
CREATE TABLE public.scene_cards (
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scene_id, card_id),
  UNIQUE (scene_id, position)
);

-- Card modifiers (depth-3 utterance helpers)
CREATE TABLE public.card_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  modifier_key text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, modifier_key)
);

-- Per-pupil scene enable/disable overrides
CREATE TABLE public.pupil_scene_overrides (
  pupil_id uuid NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pupil_id, scene_id)
);

-- Enable RLS
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pupil_scene_overrides ENABLE ROW LEVEL SECURITY;

-- Scenes: org-scoped CRUD
CREATE POLICY "Org members view scenes"
  ON public.scenes FOR SELECT TO authenticated
  USING (org_id = public.current_user_org());
CREATE POLICY "Org members insert scenes"
  ON public.scenes FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_user_org());
CREATE POLICY "Org members update scenes"
  ON public.scenes FOR UPDATE TO authenticated
  USING (org_id = public.current_user_org());
CREATE POLICY "Org members delete scenes"
  ON public.scenes FOR DELETE TO authenticated
  USING (org_id = public.current_user_org());

-- scene_cards: scoped via parent scene
CREATE POLICY "Org members view scene_cards"
  ON public.scene_cards FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = scene_id AND s.org_id = public.current_user_org()));
CREATE POLICY "Org members insert scene_cards"
  ON public.scene_cards FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = scene_id AND s.org_id = public.current_user_org()));
CREATE POLICY "Org members delete scene_cards"
  ON public.scene_cards FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = scene_id AND s.org_id = public.current_user_org()));
-- NOTE: no UPDATE policy → updates blocked at the policy level as well

-- card_modifiers: shared readable, no client writes
CREATE POLICY "Authenticated view card_modifiers"
  ON public.card_modifiers FOR SELECT TO authenticated USING (true);

-- pupil_scene_overrides: scoped via pupil's org
CREATE POLICY "Org members view pupil_scene_overrides"
  ON public.pupil_scene_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = pupil_id AND p.org_id = public.current_user_org()));
CREATE POLICY "Org members upsert pupil_scene_overrides"
  ON public.pupil_scene_overrides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = pupil_id AND p.org_id = public.current_user_org()));
CREATE POLICY "Org members update pupil_scene_overrides"
  ON public.pupil_scene_overrides FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = pupil_id AND p.org_id = public.current_user_org()));
CREATE POLICY "Org members delete pupil_scene_overrides"
  ON public.pupil_scene_overrides FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = pupil_id AND p.org_id = public.current_user_org()));

-- Position immutability trigger (motor-planning preservation)
CREATE OR REPLACE FUNCTION public.enforce_scene_card_position_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.position IS DISTINCT FROM OLD.position THEN
    RAISE EXCEPTION 'scene_cards.position is immutable: cards may be appended or removed but never re-ordered'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_scene_cards_position_immutable
  BEFORE UPDATE ON public.scene_cards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scene_card_position_immutable();

-- Seed: one Home scene per existing org with the 4 current root categories
INSERT INTO public.scenes (org_id, key, label, sort_order)
SELECT o.id, 'home', 'Home', 0 FROM public.organisations o
ON CONFLICT (org_id, key) DO NOTHING;

INSERT INTO public.scene_cards (scene_id, card_id, position)
SELECT s.id, c.id,
       CASE c.key WHEN 'food' THEN 0 WHEN 'play' THEN 1 WHEN 'feelings' THEN 2 WHEN 'toilet' THEN 3 END
FROM public.scenes s
CROSS JOIN public.cards c
WHERE s.key = 'home' AND c.category_key = 'root'
ON CONFLICT DO NOTHING;

-- Seed core-strip cards (always rendered)
INSERT INTO public.cards (key, label, source, licence, category_key) VALUES
  ('core_more',     'More',     'core', 'internal', 'core'),
  ('core_stop',     'Stop',     'core', 'internal', 'core'),
  ('core_finished', 'Finished', 'core', 'internal', 'core'),
  ('core_help',     'Help',     'core', 'internal', 'core'),
  ('core_yes',      'Yes',      'core', 'internal', 'core'),
  ('core_no',       'No',       'core', 'internal', 'core')
ON CONFLICT (key) DO NOTHING;

-- Lock down trigger function
REVOKE EXECUTE ON FUNCTION public.enforce_scene_card_position_immutable() FROM anon, authenticated, public;