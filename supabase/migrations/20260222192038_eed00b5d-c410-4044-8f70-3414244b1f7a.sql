
-- Add unique constraint for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_cost_prices_user_marketplace_offer_unique'
  ) THEN
    ALTER TABLE public.marketplace_cost_prices
    ADD CONSTRAINT marketplace_cost_prices_user_marketplace_offer_unique 
    UNIQUE (user_id, marketplace, offer_id);
  END IF;
END $$;
