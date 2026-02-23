-- Fix 1: Enable RLS on marketplace cache tables that are missing it
-- marketplace_products_cache
ALTER TABLE public.marketplace_products_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own marketplace products cache"
  ON public.marketplace_products_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all marketplace products cache"
  ON public.marketplace_products_cache FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can insert own marketplace products cache"
  ON public.marketplace_products_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own marketplace products cache"
  ON public.marketplace_products_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own marketplace products cache"
  ON public.marketplace_products_cache FOR DELETE
  USING (auth.uid() = user_id);

-- marketplace_orders_cache
ALTER TABLE public.marketplace_orders_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own marketplace orders cache"
  ON public.marketplace_orders_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all marketplace orders cache"
  ON public.marketplace_orders_cache FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can insert own marketplace orders cache"
  ON public.marketplace_orders_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own marketplace orders cache"
  ON public.marketplace_orders_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own marketplace orders cache"
  ON public.marketplace_orders_cache FOR DELETE
  USING (auth.uid() = user_id);