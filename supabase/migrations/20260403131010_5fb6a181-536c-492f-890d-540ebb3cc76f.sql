
CREATE TABLE public.marketplace_scraped_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  marketplace TEXT NOT NULL,
  data_type TEXT NOT NULL,
  source_url TEXT,
  scraped_data JSONB NOT NULL DEFAULT '{}',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scraped_data_user_mp ON public.marketplace_scraped_data (user_id, marketplace, data_type);
CREATE INDEX idx_scraped_data_date ON public.marketplace_scraped_data (scraped_at DESC);

ALTER TABLE public.marketplace_scraped_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scraped data"
ON public.marketplace_scraped_data FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraped data"
ON public.marketplace_scraped_data FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraped data"
ON public.marketplace_scraped_data FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_scraped_data;
