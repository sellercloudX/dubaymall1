
-- =====================================================
-- FIX 1: order_financials - Drop conflicting INSERT policy that allows sellers
-- =====================================================
DROP POLICY IF EXISTS "Authorized users insert financials" ON public.order_financials;

-- =====================================================
-- FIX 2: commissions - Drop conflicting INSERT policy that allows sellers
-- =====================================================
DROP POLICY IF EXISTS "System inserts commissions via RPC" ON public.commissions;

-- =====================================================
-- FIX 3: platform_revenue - Drop conflicting INSERT policy that allows sellers
-- =====================================================
DROP POLICY IF EXISTS "Admin inserts platform revenue" ON public.platform_revenue;

-- =====================================================
-- FIX 4: sellercloud_subscriptions - Replace open INSERT with secure RPC
-- =====================================================
DROP POLICY IF EXISTS "Users can create own subscription" ON public.sellercloud_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.sellercloud_subscriptions;

-- Create secure subscription creation function
CREATE OR REPLACE FUNCTION public.create_sellercloud_subscription(
  p_plan_type text,
  p_monthly_fee numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_existing_id uuid;
  v_trial_end timestamptz;
  v_sub_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check for existing subscription
  SELECT id INTO v_existing_id
  FROM public.sellercloud_subscriptions
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active subscription already exists');
  END IF;

  -- Server-controlled defaults: trial = 1 day, no admin override, no free access
  v_trial_end := now() + interval '1 day';

  INSERT INTO public.sellercloud_subscriptions (
    user_id, plan_type, monthly_fee, commission_percent,
    is_trial, is_active, activation_trial_ends, activation_fee_uzs,
    admin_override, free_access
  ) VALUES (
    v_user_id, p_plan_type, p_monthly_fee, 0,
    true, true, v_trial_end, 99000,
    false, false  -- Server enforces: no admin override, no free access
  )
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$;

-- =====================================================
-- FIX 5: subscription_payments - Replace open INSERT with secure RPC
-- =====================================================
DROP POLICY IF EXISTS "Users can insert own payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Users can create own payments" ON public.subscription_payments;

-- Create secure payment creation function (always starts as 'pending')
CREATE OR REPLACE FUNCTION public.create_subscription_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_payment_type text DEFAULT 'activation'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_sub_owner uuid;
  v_payment_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Verify subscription belongs to caller
  SELECT user_id INTO v_sub_owner
  FROM public.sellercloud_subscriptions
  WHERE id = p_subscription_id;

  IF v_sub_owner IS NULL OR v_sub_owner != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;

  -- Server enforces payment_status = 'pending'
  INSERT INTO public.subscription_payments (
    user_id, subscription_id, amount, payment_type, payment_status
  ) VALUES (
    v_user_id, p_subscription_id, p_amount, p_payment_type, 'pending'
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;
