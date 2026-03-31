
-- Add unique constraints to prevent duplicate products and orders in cache tables
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_products_cache_unique 
  ON public.marketplace_products_cache (user_id, marketplace, offer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_orders_cache_unique 
  ON public.marketplace_orders_cache (user_id, marketplace, order_id);
