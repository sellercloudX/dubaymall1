
-- Add video_type (youtube, instagram, telegram) and is_free flag
ALTER TABLE public.tutorial_videos 
  ADD COLUMN IF NOT EXISTS video_type text NOT NULL DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS embed_url text;

-- Rename youtube_url to content_url for multi-platform support
ALTER TABLE public.tutorial_videos RENAME COLUMN youtube_url TO content_url;

COMMENT ON COLUMN public.tutorial_videos.video_type IS 'youtube, instagram, telegram';
COMMENT ON COLUMN public.tutorial_videos.is_free IS 'true = visible to all, false = only active subscribers';
COMMENT ON COLUMN public.tutorial_videos.embed_url IS 'Optional direct embed URL for instagram/telegram';
