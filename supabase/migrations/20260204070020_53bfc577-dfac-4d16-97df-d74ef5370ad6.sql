-- Create table to store marketplace connections
CREATE TABLE public.marketplace_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL, -- 'yandex', 'uzum', 'wildberries', 'ozon'
  credentials JSONB NOT NULL DEFAULT '{}', -- Encrypted API keys, campaign IDs
  account_info JSONB DEFAULT '{}', -- Store name, status, etc.
  products_count INTEGER DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, marketplace)
);

-- Enable RLS
ALTER TABLE public.marketplace_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own connections
CREATE POLICY "Users can view own connections"
ON public.marketplace_connections FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own connections
CREATE POLICY "Users can create own connections"
ON public.marketplace_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connections
CREATE POLICY "Users can update own connections"
ON public.marketplace_connections FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own connections
CREATE POLICY "Users can delete own connections"
ON public.marketplace_connections FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_marketplace_connections_user ON public.marketplace_connections(user_id);
CREATE INDEX idx_marketplace_connections_marketplace ON public.marketplace_connections(marketplace);

-- Trigger to update updated_at
CREATE TRIGGER update_marketplace_connections_updated_at
BEFORE UPDATE ON public.marketplace_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();