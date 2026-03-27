
-- Tutorial folders table
CREATE TABLE public.tutorial_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cover_image_url text,
  sort_order int DEFAULT 0,
  is_published boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tutorial_folders ENABLE ROW LEVEL SECURITY;

-- Anyone can read published folders
CREATE POLICY "Anyone can read published folders" ON public.tutorial_folders
  FOR SELECT TO authenticated USING (is_published = true);

-- Admins can manage folders
CREATE POLICY "Admins can manage folders" ON public.tutorial_folders
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add folder_id to tutorial_videos
ALTER TABLE public.tutorial_videos ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.tutorial_folders(id) ON DELETE SET NULL;

-- Add feature_key column to tutorial_videos for linking to specific features
ALTER TABLE public.tutorial_videos ADD COLUMN IF NOT EXISTS feature_key text;
