
-- Table for tracking subscription payments
CREATE TABLE public.subscription_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.sellercloud_subscriptions(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UZS',
  payment_method TEXT NOT NULL DEFAULT 'click',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  click_trans_id TEXT,
  click_paydoc_id TEXT,
  months_covered INTEGER NOT NULL DEFAULT 1,
  payment_type TEXT NOT NULL DEFAULT 'subscription',
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own subscription payments"
  ON public.subscription_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own payments
CREATE POLICY "Users can create own subscription payments"
  ON public.subscription_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all payments
CREATE POLICY "Admins can view all subscription payments"
  ON public.subscription_payments FOR SELECT
  USING (public.has_admin_permission(auth.uid(), 'can_manage_finances'));

-- Admins can update payments
CREATE POLICY "Admins can update subscription payments"
  ON public.subscription_payments FOR UPDATE
  USING (public.has_admin_permission(auth.uid(), 'can_manage_finances'));

-- Create index for fast lookups
CREATE INDEX idx_subscription_payments_user ON public.subscription_payments(user_id);
CREATE INDEX idx_subscription_payments_status ON public.subscription_payments(payment_status);
CREATE INDEX idx_subscription_payments_subscription ON public.subscription_payments(subscription_id);
