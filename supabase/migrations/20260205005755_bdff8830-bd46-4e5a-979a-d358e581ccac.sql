-- Marketplace products cache table
CREATE TABLE public.marketplace_products_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  marketplace TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, marketplace, offer_id)
);

-- Marketplace orders cache table
CREATE TABLE public.marketplace_orders_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  marketplace TEXT NOT NULL,
  order_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, marketplace, order_id)
);

-- Marketplace stats cache table (aggregated data)
CREATE TABLE public.marketplace_stats_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  marketplace TEXT NOT NULL,
  stats_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_products INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  pending_orders INTEGER DEFAULT 0,
  low_stock_count INTEGER DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, marketplace, stats_date)
);

-- Enable RLS
ALTER TABLE public.marketplace_products_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_stats_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products cache
CREATE POLICY "Users can view own products cache"
  ON public.marketplace_products_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products cache"
  ON public.marketplace_products_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products cache"
  ON public.marketplace_products_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products cache"
  ON public.marketplace_products_cache FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for orders cache
CREATE POLICY "Users can view own orders cache"
  ON public.marketplace_orders_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders cache"
  ON public.marketplace_orders_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders cache"
  ON public.marketplace_orders_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders cache"
  ON public.marketplace_orders_cache FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for stats cache
CREATE POLICY "Users can view own stats cache"
  ON public.marketplace_stats_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats cache"
  ON public.marketplace_stats_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats cache"
  ON public.marketplace_stats_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stats cache"
  ON public.marketplace_stats_cache FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for fast queries
CREATE INDEX idx_products_cache_user_mp ON public.marketplace_products_cache(user_id, marketplace);
CREATE INDEX idx_orders_cache_user_mp ON public.marketplace_orders_cache(user_id, marketplace);
CREATE INDEX idx_orders_cache_status ON public.marketplace_orders_cache(user_id, marketplace, status);
CREATE INDEX idx_stats_cache_user_mp ON public.marketplace_stats_cache(user_id, marketplace);

-- Enable realtime for cache tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_products_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_stats_cache;