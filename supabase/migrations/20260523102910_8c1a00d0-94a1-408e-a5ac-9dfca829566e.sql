-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('ta', 'senco');

-- Organisations
CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles (one per auth user)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'ta',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pupils
CREATE TABLE public.pupils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  year_group int,
  ehcp_categories text[] DEFAULT '{}'::text[],
  makaton_stage int,
  grid_size int NOT NULL DEFAULT 6,
  depth_setting int NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cards catalogue
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  symbol_url text,
  source text,
  licence text,
  attribution text,
  makaton_stage int,
  category_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pupils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  )
$$;

-- Policies: organisations
CREATE POLICY "Members can view their organisation"
  ON public.organisations FOR SELECT
  TO authenticated
  USING (id = public.current_user_org());

-- Policies: profiles
CREATE POLICY "Users view profiles in their org"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (org_id = public.current_user_org() OR id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Policies: pupils (full CRUD within org)
CREATE POLICY "Org members view pupils"
  ON public.pupils FOR SELECT
  TO authenticated
  USING (org_id = public.current_user_org());

CREATE POLICY "Org members insert pupils"
  ON public.pupils FOR INSERT
  TO authenticated
  WITH CHECK (org_id = public.current_user_org());

CREATE POLICY "Org members update pupils"
  ON public.pupils FOR UPDATE
  TO authenticated
  USING (org_id = public.current_user_org());

CREATE POLICY "Org members delete pupils"
  ON public.pupils FOR DELETE
  TO authenticated
  USING (org_id = public.current_user_org());

-- Policies: cards (shared read-only catalogue)
CREATE POLICY "Authenticated users view cards"
  ON public.cards FOR SELECT
  TO authenticated
  USING (true);

-- Default org + signup trigger
INSERT INTO public.organisations (id, name, region)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Org', NULL);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, org_id, role, display_name)
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001',
    'ta',
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed cards (4 categories + 16 sub-items)
INSERT INTO public.cards (key, label, symbol_url, source, licence, category_key, makaton_stage) VALUES
  ('food',     'Food',       '/symbols/food.png',     'local', 'internal', 'root', 1),
  ('play',     'Play',       '/symbols/play.png',     'local', 'internal', 'root', 1),
  ('feelings', 'Feelings',   '/symbols/feelings.png', 'local', 'internal', 'root', 1),
  ('toilet',   'Toilet',     '/symbols/toilet.png',   'local', 'internal', 'root', 1),
  ('apple',    'Apple',      '/symbols/apple.png',    'local', 'internal', 'food', 1),
  ('biscuit',  'Biscuit',    '/symbols/biscuit.png',  'local', 'internal', 'food', 1),
  ('water',    'Water',      '/symbols/water.png',    'local', 'internal', 'food', 1),
  ('bread',    'Bread',      '/symbols/bread.png',    'local', 'internal', 'food', 1),
  ('game',     'Game',       '/symbols/game.png',     'local', 'internal', 'play', 1),
  ('blocks',   'Blocks',     '/symbols/blocks.png',   'local', 'internal', 'play', 1),
  ('book',     'Book',       '/symbols/book.png',     'local', 'internal', 'play', 1),
  ('music',    'Music',      '/symbols/music.png',    'local', 'internal', 'play', 1),
  ('happy',    'Happy',      '/symbols/happy.png',    'local', 'internal', 'feelings', 1),
  ('sad',      'Sad',        '/symbols/sad.png',      'local', 'internal', 'feelings', 1),
  ('love',     'Love',       '/symbols/love.png',     'local', 'internal', 'feelings', 1),
  ('good',     'Good',       '/symbols/good.png',     'local', 'internal', 'feelings', 1),
  ('toilet_sub','Toilet',    '/symbols/toilet.png',   'local', 'internal', 'toilet', 1),
  ('wash',     'Wash Hands', '/symbols/wash.png',     'local', 'internal', 'toilet', 1),
  ('help',     'Help',       '/symbols/help.png',     'local', 'internal', 'toilet', 1),
  ('change',   'Change',     '/symbols/change.png',   'local', 'internal', 'toilet', 1);