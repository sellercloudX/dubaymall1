
-- Add activation duration tracking
ALTER TABLE public.sellercloud_subscriptions 
ADD COLUMN IF NOT EXISTS activated_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS activated_by TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS free_access BOOLEAN DEFAULT false;

-- Update check_sellercloud_access to handle expiry-based activation
CREATE OR REPLACE FUNCTION public.check_sellercloud_access(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_total_debt NUMERIC;
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
      'message', 'Obuna mavjud emas. To''lov qiling yoki admin bilan bog''laning.'
    );
  END IF;

  -- Check if free access granted by admin
  IF v_subscription.free_access = true AND v_subscription.admin_override = true THEN
    -- Still check if activated_until has expired
    IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until < NOW() THEN
      -- Free access expired, deactivate
      UPDATE public.sellercloud_subscriptions 
      SET is_active = false, free_access = false, admin_override = false
      WHERE id = v_subscription.id;
      
      RETURN json_build_object(
        'is_active', false,
        'reason', 'inactive',
        'message', 'Bepul foydalanish muddati tugadi. To''lov qiling yoki admin bilan bog''laning.',
        'subscription', row_to_json(v_subscription)
      );
    END IF;
    
    RETURN json_build_object(
      'is_active', true,
      'reason', 'admin_override',
      'message', 'Admin tomonidan aktivlashtirilgan',
      'activated_until', v_subscription.activated_until,
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  -- Check if admin override is active (with duration check)
  IF v_subscription.admin_override = true THEN
    IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until < NOW() THEN
      UPDATE public.sellercloud_subscriptions 
      SET is_active = false, admin_override = false
      WHERE id = v_subscription.id;
      
      RETURN json_build_object(
        'is_active', false,
        'reason', 'inactive',
        'message', 'Aktivatsiya muddati tugadi. To''lov qiling yoki admin bilan bog''laning.',
        'subscription', row_to_json(v_subscription)
      );
    END IF;
    
    RETURN json_build_object(
      'is_active', true,
      'reason', 'admin_override',
      'message', 'Premium foydalanuvchi',
      'activated_until', v_subscription.activated_until,
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  -- Check if paid and active with duration
  IF v_subscription.is_active = true THEN
    IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until < NOW() THEN
      UPDATE public.sellercloud_subscriptions 
      SET is_active = false
      WHERE id = v_subscription.id;
      
      RETURN json_build_object(
        'is_active', false,
        'reason', 'inactive',
        'message', 'Obuna muddati tugadi. Yangilash uchun to''lov qiling yoki admin bilan bog''laning.',
        'subscription', row_to_json(v_subscription)
      );
    END IF;
    
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Faol obuna',
      'activated_until', v_subscription.activated_until,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- Check total debt
  SELECT COALESCE(SUM(balance_due), 0) INTO v_total_debt
  FROM public.sellercloud_billing
  WHERE user_id = p_user_id AND status IN ('pending', 'overdue');
  
  IF v_total_debt > 0 THEN
    RETURN json_build_object(
      'is_active', false,
      'reason', 'debt',
      'message', 'Qarzdorlik mavjud. To''lov qiling yoki admin bilan bog''laning.',
      'total_debt', v_total_debt,
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  -- Profile not completed or payment not made
  IF v_subscription.profile_completed = false THEN
    RETURN json_build_object(
      'is_active', false,
      'reason', 'inactive',
      'message', 'Shaxsiy ma''lumotlarni to''ldiring va to''lov qiling.',
      'subscription', row_to_json(v_subscription)
    );
  END IF;
  
  RETURN json_build_object(
    'is_active', false,
    'reason', 'inactive',
    'message', 'Obuna faol emas. To''lov qiling yoki admin bilan bog''laning.',
    'subscription', row_to_json(v_subscription)
  );
END;
$$;

-- Function to activate subscription for a specific duration based on payment
CREATE OR REPLACE FUNCTION public.activate_subscription_by_payment(
  p_subscription_id UUID,
  p_months INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_until TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT activated_until INTO v_current_until
  FROM public.sellercloud_subscriptions
  WHERE id = p_subscription_id;
  
  -- If already active and not expired, extend from current end date
  IF v_current_until IS NOT NULL AND v_current_until > NOW() THEN
    UPDATE public.sellercloud_subscriptions
    SET is_active = true,
        activated_until = v_current_until + (p_months || ' months')::interval,
        initial_payment_completed = true,
        initial_payment_at = COALESCE(initial_payment_at, NOW()),
        updated_at = NOW()
    WHERE id = p_subscription_id;
  ELSE
    -- Start fresh from now
    UPDATE public.sellercloud_subscriptions
    SET is_active = true,
        activated_until = NOW() + (p_months || ' months')::interval,
        initial_payment_completed = true,
        initial_payment_at = COALESCE(initial_payment_at, NOW()),
        updated_at = NOW()
    WHERE id = p_subscription_id;
  END IF;
END;
$$;
