
-- Tutorial videos table for Qo'llanma section
CREATE TABLE public.tutorial_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;

-- Everyone with active session can view published videos
CREATE POLICY "Authenticated users can view published tutorials"
ON public.tutorial_videos FOR SELECT TO authenticated
USING (is_published = true);

-- Only admins can manage tutorials
CREATE POLICY "Admins can manage tutorials"
ON public.tutorial_videos FOR ALL TO authenticated
USING (public.has_admin_permission(auth.uid(), 'can_manage_content'))
WITH CHECK (public.has_admin_permission(auth.uid(), 'can_manage_content'));

-- Trigger for updated_at
CREATE TRIGGER update_tutorial_videos_updated_at
BEFORE UPDATE ON public.tutorial_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
