
-- Create table for tracking Uzum Bank transactions (both Merchant API and Checkout)
CREATE TABLE public.uzum_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Transaction identifiers
  trans_id TEXT, -- Uzum Bank transId (Merchant API) or orderId (Checkout)
  order_number TEXT NOT NULL, -- Our internal order number (e.g. SCX-250223-A1B2C3)
  -- Payment method
  payment_method TEXT NOT NULL DEFAULT 'checkout', -- 'merchant_api' or 'checkout'
  -- Financial
  amount BIGINT NOT NULL, -- Amount in tiyin (1 UZS = 100 tiyin)
  currency INTEGER NOT NULL DEFAULT 860, -- ISO 4217: 860 = UZS
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED, CONFIRMED, REVERSED, FAILED, COMPLETED, DECLINED, REFUNDED, REGISTERED, AUTHORIZED
  -- Subscription link
  subscription_id UUID,
  months INTEGER DEFAULT 1,
  -- Merchant API specific
  service_id INTEGER,
  -- Checkout specific
  checkout_order_id TEXT, -- orderId from Uzum Checkout
  payment_redirect_url TEXT,
  -- Payment source info
  payment_source TEXT, -- UZCARD, HUMO, VISA, etc.
  phone TEXT,
  -- Promo
  promo_data JSONB,
  -- Metadata
  account_params JSONB, -- params.account from Merchant API
  callback_data JSONB, -- Last callback/webhook data received
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  reversed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.uzum_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own uzum transactions"
  ON public.uzum_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role (edge functions) can insert/update
CREATE POLICY "Service role can insert uzum transactions"
  ON public.uzum_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can update uzum transactions"
  ON public.uzum_transactions FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_uzum_transactions_user_id ON public.uzum_transactions(user_id);
CREATE INDEX idx_uzum_transactions_trans_id ON public.uzum_transactions(trans_id);
CREATE INDEX idx_uzum_transactions_order_number ON public.uzum_transactions(order_number);
CREATE INDEX idx_uzum_transactions_status ON public.uzum_transactions(status);

-- Updated at trigger
CREATE TRIGGER update_uzum_transactions_updated_at
  BEFORE UPDATE ON public.uzum_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
