
-- Normalise existing sources to the allowed enum-ish values.
UPDATE public.cards SET source = 'manual' WHERE source IN ('local','core') OR source IS NULL;
UPDATE public.cards SET licence = 'internal-seed' WHERE licence IS NULL;
UPDATE public.cards SET attribution = 'Seeded fixture symbol' WHERE attribution IS NULL;

ALTER TABLE public.cards
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN licence SET NOT NULL,
  ALTER COLUMN attribution SET NOT NULL,
  ADD CONSTRAINT cards_source_chk CHECK (source IN ('arasaac','mulberry','sclera','ai','manual','makaton'));

ALTER TABLE public.pupils
  ADD COLUMN makaton_licensed boolean NOT NULL DEFAULT false;

CREATE TABLE public.symbol_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  label text NOT NULL,
  candidate_url text NOT NULL,
  source text NOT NULL DEFAULT 'ai',
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewer_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_symbol_review_queue_org_state ON public.symbol_review_queue(org_id, state);
ALTER TABLE public.symbol_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view review queue"
ON public.symbol_review_queue FOR SELECT TO authenticated
USING (org_id = current_user_org());
CREATE POLICY "Org members insert into review queue"
ON public.symbol_review_queue FOR INSERT TO authenticated
WITH CHECK (org_id = current_user_org());
CREATE POLICY "Sencos update review queue"
ON public.symbol_review_queue FOR UPDATE TO authenticated
USING (org_id = current_user_org() AND has_role(auth.uid(), 'senco'));
CREATE POLICY "Sencos delete review queue"
ON public.symbol_review_queue FOR DELETE TO authenticated
USING (org_id = current_user_org() AND has_role(auth.uid(), 'senco'));

CREATE TABLE public.org_symbol_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  label text NOT NULL,
  image_url text NOT NULL,
  attribution text NOT NULL DEFAULT 'Licensed Makaton symbol (org-supplied)',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, label)
);
ALTER TABLE public.org_symbol_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view symbol pack"
ON public.org_symbol_packs FOR SELECT TO authenticated
USING (org_id = current_user_org());
CREATE POLICY "Sencos insert symbol pack"
ON public.org_symbol_packs FOR INSERT TO authenticated
WITH CHECK (org_id = current_user_org() AND has_role(auth.uid(), 'senco'));
CREATE POLICY "Sencos update symbol pack"
ON public.org_symbol_packs FOR UPDATE TO authenticated
USING (org_id = current_user_org() AND has_role(auth.uid(), 'senco'));
CREATE POLICY "Sencos delete symbol pack"
ON public.org_symbol_packs FOR DELETE TO authenticated
USING (org_id = current_user_org() AND has_role(auth.uid(), 'senco'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('symbol-cache', 'symbol-cache', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read symbol cache"
ON storage.objects FOR SELECT
USING (bucket_id = 'symbol-cache');

CREATE POLICY "Authenticated write symbol cache"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'symbol-cache');
