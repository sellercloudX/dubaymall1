
-- Add unique constraint to clone_history for proper upsert support
ALTER TABLE public.clone_history 
ADD CONSTRAINT clone_history_unique_entry 
UNIQUE (user_id, source_marketplace, source_offer_id, target_marketplace);
