ALTER TABLE public.feature_pricing 
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'per_use';

ALTER TABLE public.feature_pricing 
  ADD COLUMN IF NOT EXISTS monthly_limit integer DEFAULT NULL;