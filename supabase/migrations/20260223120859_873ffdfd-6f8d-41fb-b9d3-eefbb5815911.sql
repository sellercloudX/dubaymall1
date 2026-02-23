
-- Track which products have been cloned to which marketplace
CREATE TABLE public.clone_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_marketplace TEXT NOT NULL,
  source_offer_id TEXT NOT NULL,
  target_marketplace TEXT NOT NULL,
  cloned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'success',
  UNIQUE(user_id, source_marketplace, source_offer_id, target_marketplace)
);

ALTER TABLE public.clone_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clone history"
ON public.clone_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clone history"
ON public.clone_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clone history"
ON public.clone_history FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_clone_history_user_target ON public.clone_history(user_id, target_marketplace);
CREATE INDEX idx_clone_history_lookup ON public.clone_history(user_id, source_marketplace, source_offer_id, target_marketplace);
