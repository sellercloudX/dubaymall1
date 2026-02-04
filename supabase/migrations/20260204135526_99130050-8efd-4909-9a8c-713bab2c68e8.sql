-- SellerCloudX Subscriptions table
CREATE TABLE public.sellercloud_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'pro', -- 'pro' ($499 + 4%), 'enterprise' (individual + 2%)
  monthly_fee NUMERIC NOT NULL DEFAULT 499, -- USD
  commission_percent NUMERIC NOT NULL DEFAULT 4, -- savdodan foiz
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_trial BOOLEAN NOT NULL DEFAULT true,
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  admin_override BOOLEAN NOT NULL DEFAULT false, -- admin tomondan aktivlashtirilgan
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SellerCloudX Billing/Debt tracking
CREATE TABLE public.sellercloud_billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.sellercloud_subscriptions(id),
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  monthly_fee_amount NUMERIC NOT NULL DEFAULT 0, -- $499 in UZS
  sales_commission_amount NUMERIC NOT NULL DEFAULT 0, -- foizdan hisoblangan
  total_sales_volume NUMERIC NOT NULL DEFAULT 0, -- jami savdo hajmi
  commission_percent NUMERIC NOT NULL DEFAULT 4,
  total_due NUMERIC NOT NULL DEFAULT 0, -- jami to'lanishi kerak
  total_paid NUMERIC NOT NULL DEFAULT 0,
  balance_due NUMERIC NOT NULL DEFAULT 0, -- qarzdorlik
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, waived
  paid_at TIMESTAMP WITH TIME ZONE,
  waived_by UUID, -- admin tomondan bekor qilingan
  waived_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SellerCloudX Payments history
CREATE TABLE public.sellercloud_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  billing_id UUID REFERENCES public.sellercloud_billing(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- 'card', 'transfer', 'admin_waive'
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sellercloud_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellercloud_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellercloud_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscription" ON public.sellercloud_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscription" ON public.sellercloud_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.sellercloud_subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update subscriptions" ON public.sellercloud_subscriptions
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for billing
CREATE POLICY "Users can view own billing" ON public.sellercloud_billing
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all billing" ON public.sellercloud_billing
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can manage billing" ON public.sellercloud_billing
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "System can insert billing" ON public.sellercloud_billing
  FOR INSERT WITH CHECK (true);

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON public.sellercloud_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments" ON public.sellercloud_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage payments" ON public.sellercloud_payments
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

-- Function to calculate SellerCloudX billing
CREATE OR REPLACE FUNCTION public.calculate_sellercloud_billing(
  p_user_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_total_sales NUMERIC
) RETURNS JSON AS $$
DECLARE
  v_subscription RECORD;
  v_monthly_fee_uzs NUMERIC;
  v_commission_amount NUMERIC;
  v_total_due NUMERIC;
  v_usd_rate NUMERIC := 12800; -- 1 USD = 12800 UZS
BEGIN
  -- Get user's subscription
  SELECT * INTO v_subscription 
  FROM public.sellercloud_subscriptions 
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  IF v_subscription IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No active subscription'
    );
  END IF;
  
  -- Calculate monthly fee in UZS
  v_monthly_fee_uzs := v_subscription.monthly_fee * v_usd_rate;
  
  -- Calculate commission from sales
  v_commission_amount := p_total_sales * (v_subscription.commission_percent / 100);
  
  -- Total due
  v_total_due := v_monthly_fee_uzs + v_commission_amount;
  
  RETURN json_build_object(
    'success', true,
    'monthly_fee_uzs', v_monthly_fee_uzs,
    'commission_amount', v_commission_amount,
    'commission_percent', v_subscription.commission_percent,
    'total_sales', p_total_sales,
    'total_due', v_total_due,
    'plan_type', v_subscription.plan_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user account is active
CREATE OR REPLACE FUNCTION public.check_sellercloud_access(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_subscription RECORD;
  v_total_debt NUMERIC;
  v_is_active BOOLEAN := false;
  v_reason TEXT;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription 
  FROM public.sellercloud_subscriptions 
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription IS NULL THEN
    RETURN json_build_object(
      'is_active', false,
      'reason', 'no_subscription',
      'message', 'Obuna mavjud emas'
    );
  END IF;
  
  -- Check if admin override is active
  IF v_subscription.admin_override = true THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'admin_override',
      'message', 'Admin tomondan aktivlashtirilgan',
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  -- Check if trial is active
  IF v_subscription.is_trial = true AND v_subscription.trial_ends_at > now() THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'trial',
      'message', 'Sinov davri',
      'trial_ends_at', v_subscription.trial_ends_at,
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  -- Check total debt
  SELECT COALESCE(SUM(balance_due), 0) INTO v_total_debt
  FROM public.sellercloud_billing
  WHERE user_id = p_user_id AND status IN ('pending', 'overdue');
  
  IF v_total_debt > 0 AND v_subscription.is_active = false THEN
    RETURN json_build_object(
      'is_active', false,
      'reason', 'debt',
      'message', 'Qarzdorlik mavjud',
      'total_debt', v_total_debt,
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  -- Check subscription status
  IF v_subscription.is_active = true THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Faol obuna',
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  RETURN json_build_object(
    'is_active', false,
    'reason', 'inactive',
    'message', 'Obuna faol emas',
    'subscription', row_to_json(v_subscription)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update updated_at
CREATE TRIGGER update_sellercloud_subscriptions_updated_at
  BEFORE UPDATE ON public.sellercloud_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sellercloud_billing_updated_at
  BEFORE UPDATE ON public.sellercloud_billing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();