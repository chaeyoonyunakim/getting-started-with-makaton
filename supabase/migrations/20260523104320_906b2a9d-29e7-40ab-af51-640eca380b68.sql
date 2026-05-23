
-- card_selections: raw event log
CREATE TABLE public.card_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id uuid NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  from_card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  to_card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_selections_pupil_scene ON public.card_selections(pupil_id, scene_id);
CREATE INDEX idx_card_selections_from ON public.card_selections(from_card_id);

ALTER TABLE public.card_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view card_selections"
ON public.card_selections FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = card_selections.pupil_id AND p.org_id = current_user_org()));

CREATE POLICY "Org members insert card_selections"
ON public.card_selections FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = card_selections.pupil_id AND p.org_id = current_user_org()));

-- bandit_arms: global Beta(alpha,beta) per scene/card
CREATE TABLE public.bandit_arms (
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  alpha double precision NOT NULL DEFAULT 1.0,
  beta double precision NOT NULL DEFAULT 1.0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scene_id, card_id)
);

ALTER TABLE public.bandit_arms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view bandit_arms"
ON public.bandit_arms FOR SELECT TO authenticated USING (true);

-- predictions_log
CREATE TABLE public.predictions_log (
  prediction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id uuid NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  current_card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  top3 jsonb NOT NULL,
  chosen_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_predictions_log_pupil ON public.predictions_log(pupil_id, ts DESC);

ALTER TABLE public.predictions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view predictions_log"
ON public.predictions_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = predictions_log.pupil_id AND p.org_id = current_user_org()));

CREATE POLICY "Org members insert predictions_log"
ON public.predictions_log FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = predictions_log.pupil_id AND p.org_id = current_user_org()));

CREATE POLICY "Org members update predictions_log"
ON public.predictions_log FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = predictions_log.pupil_id AND p.org_id = current_user_org()));

-- Materialised view for transitions
CREATE MATERIALIZED VIEW public.mv_pupil_transitions AS
SELECT
  pupil_id,
  scene_id,
  from_card_id,
  to_card_id,
  COUNT(*)::int AS count,
  MAX(created_at) AS last_seen_at
FROM public.card_selections
WHERE from_card_id IS NOT NULL
GROUP BY pupil_id, scene_id, from_card_id, to_card_id;

CREATE UNIQUE INDEX idx_mv_pupil_transitions_pk
  ON public.mv_pupil_transitions(pupil_id, scene_id, from_card_id, to_card_id);
CREATE INDEX idx_mv_pupil_transitions_lookup
  ON public.mv_pupil_transitions(pupil_id, scene_id, from_card_id);
