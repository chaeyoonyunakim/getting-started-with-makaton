
-- sessions
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id uuid NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  ta_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  depth_used int,
  scene_count int NOT NULL DEFAULT 0,
  total_selections int NOT NULL DEFAULT 0,
  golden_sign_awarded boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_sessions_pupil ON public.sessions(pupil_id, started_at DESC);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view sessions"
ON public.sessions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = sessions.pupil_id AND p.org_id = current_user_org()));
CREATE POLICY "Org members insert sessions"
ON public.sessions FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = sessions.pupil_id AND p.org_id = current_user_org()));
CREATE POLICY "Org members update sessions"
ON public.sessions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.pupils p WHERE p.id = sessions.pupil_id AND p.org_id = current_user_org()));

-- card_selections additions
ALTER TABLE public.card_selections
  ADD COLUMN IF NOT EXISTS predicted_in_top3 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dwell_ms int;
-- session_id already existed in this table; relink it to sessions for cascade behaviour.
ALTER TABLE public.card_selections
  ADD CONSTRAINT card_selections_session_fk
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE
  NOT VALID;

-- org settings
CREATE TABLE public.org_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  retention_days int NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 3650),
  reward_min_selections int NOT NULL DEFAULT 5,
  reward_min_distinct_scenes int NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view org_settings"
ON public.org_settings FOR SELECT TO authenticated
USING (org_id = current_user_org());
CREATE POLICY "Sencos update org_settings"
ON public.org_settings FOR UPDATE TO authenticated
USING (org_id = current_user_org() AND has_role(auth.uid(), 'senco'));
CREATE POLICY "Sencos insert org_settings"
ON public.org_settings FOR INSERT TO authenticated
WITH CHECK (org_id = current_user_org() AND has_role(auth.uid(), 'senco'));

-- Seed default org settings
INSERT INTO public.org_settings (org_id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (org_id) DO NOTHING;

-- TA notifications (replaces Slack)
CREATE TABLE public.ta_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  pupil_id uuid REFERENCES public.pupils(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  child_name text NOT NULL,
  selection text NOT NULL,
  rationale text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ta_notifications_org ON public.ta_notifications(org_id, created_at DESC);
ALTER TABLE public.ta_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view ta_notifications"
ON public.ta_notifications FOR SELECT TO authenticated
USING (org_id = current_user_org());
CREATE POLICY "Org members insert ta_notifications"
ON public.ta_notifications FOR INSERT TO authenticated
WITH CHECK (org_id = current_user_org());
CREATE POLICY "Org members update ta_notifications"
ON public.ta_notifications FOR UPDATE TO authenticated
USING (org_id = current_user_org());

ALTER PUBLICATION supabase_realtime ADD TABLE public.ta_notifications;
ALTER TABLE public.ta_notifications REPLICA IDENTITY FULL;
