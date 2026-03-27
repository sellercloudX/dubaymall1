-- Enable realtime on remaining tables (marketplace_products_cache already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders_cache;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_cost_prices;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;