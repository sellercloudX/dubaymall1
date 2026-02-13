
-- Add merchant_trans_id column to subscription_payments for clean payment number tracking
ALTER TABLE public.subscription_payments 
ADD COLUMN IF NOT EXISTS merchant_trans_id TEXT;

-- Add index for fast lookup by merchant_trans_id
CREATE INDEX IF NOT EXISTS idx_subscription_payments_merchant_trans_id 
ON public.subscription_payments(merchant_trans_id);
