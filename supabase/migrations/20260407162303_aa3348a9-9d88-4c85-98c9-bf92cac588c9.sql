
-- 1. Update create_sellercloud_subscription: No trial, free plan = permanently active
CREATE OR REPLACE FUNCTION public.create_sellercloud_subscription(p_plan_type text, p_monthly_fee numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_existing_id uuid;
  v_sub_id uuid;
  v_is_free boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.sellercloud_subscriptions
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active subscription already exists');
  END IF;

  -- Free plan (starter) = permanently active, no trial needed
  v_is_free := (p_plan_type = 'starter' OR p_monthly_fee = 0);

  INSERT INTO public.sellercloud_subscriptions (
    user_id, plan_type, plan_slug, monthly_fee, commission_percent,
    is_trial, is_active, activation_trial_ends, activation_fee_uzs,
    admin_override, free_access,
    activated_until
  ) VALUES (
    v_user_id, p_plan_type, p_plan_type, p_monthly_fee, 0,
    false, true, NULL, 
    CASE WHEN v_is_free THEN 0 ELSE 99000 END,
    false, v_is_free,
    CASE WHEN v_is_free THEN '2099-12-31'::timestamptz ELSE NULL END
  )
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END;
$function$;

-- 2. Update check_sellercloud_access: Free tier always active
CREATE OR REPLACE FUNCTION public.check_sellercloud_access(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_days_left INTEGER;
  v_expiry TIMESTAMP WITH TIME ZONE;
  v_plan RECORD;
BEGIN
  SELECT * INTO v_subscription 
  FROM public.sellercloud_subscriptions 
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription IS NULL THEN
    RETURN json_build_object(
      'is_active', false,
      'reason', 'no_subscription',
      'message', 'Obuna topilmadi. Tarifni tanlang.'
    );
  END IF;

  -- Get plan details
  SELECT * INTO v_plan FROM subscription_plans 
  WHERE slug = COALESCE(v_subscription.plan_slug, v_subscription.plan_type)
  LIMIT 1;

  -- Free plan (monthly_fee = 0) is always active
  IF v_plan.id IS NOT NULL AND v_plan.monthly_fee_uzs = 0 THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Bepul tarif — doimiy faol',
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- Admin override
  IF v_subscription.admin_override THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'admin_override',
      'message', 'Admin tomonidan faollashtirilgan',
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- Check activation dates (paid plans)
  v_expiry := GREATEST(
    COALESCE(v_subscription.activation_paid_until, '1970-01-01'::timestamptz),
    COALESCE(v_subscription.activated_until, '1970-01-01'::timestamptz)
  );

  IF v_expiry > now() THEN
    v_days_left := EXTRACT(DAY FROM (v_expiry - now()))::integer;
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Obuna faol',
      'subscription', row_to_json(v_subscription),
      'expires_at', v_expiry,
      'days_left', v_days_left,
      'warning', v_days_left <= 3
    );
  END IF;

  -- Not active
  IF NOT v_subscription.is_active THEN
    RETURN json_build_object(
      'is_active', false,
      'reason', 'inactive',
      'message', 'Obuna faol emas. To''lovni amalga oshiring.',
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- Expired
  RETURN json_build_object(
    'is_active', false,
    'reason', 'expired',
    'message', 'Obuna muddati tugagan. Yangilang.',
    'subscription', row_to_json(v_subscription),
    'blocked', true
  );
END;
$function$;

-- 3. Update check_feature_access: Free tier doesn't need activation check
CREATE OR REPLACE FUNCTION public.check_feature_access(p_user_id uuid, p_feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_feature feature_pricing%ROWTYPE;
  v_balance numeric;
  v_sub record;
  v_price numeric;
  v_tier text;
  v_activation_ok boolean := false;
  v_plan record;
  v_discount int := 0;
  v_billing_type text;
BEGIN
  SELECT * INTO v_feature FROM feature_pricing WHERE feature_key = p_feature_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'unknown');
  END IF;

  IF NOT v_feature.is_enabled THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'feature_disabled', 'message', 'Bu funksiya hozircha o''chirilgan');
  END IF;

  IF v_feature.is_free THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'free');
  END IF;

  v_billing_type := COALESCE(v_feature.billing_type, 'per_use');

  SELECT * INTO v_sub FROM sellercloud_subscriptions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;

  -- Get plan details
  SELECT * INTO v_plan FROM subscription_plans 
  WHERE slug = COALESCE(v_sub.plan_slug, v_sub.plan_type)
  LIMIT 1;

  -- Determine activation status
  IF v_sub.id IS NOT NULL THEN
    -- Free plan (monthly_fee = 0) is always active
    IF v_plan.id IS NOT NULL AND v_plan.monthly_fee_uzs = 0 THEN
      v_activation_ok := true;
    ELSIF v_sub.admin_override THEN
      v_activation_ok := true;
    ELSIF v_sub.activation_paid_until IS NOT NULL AND v_sub.activation_paid_until > now() THEN
      v_activation_ok := true;
    ELSIF v_sub.activated_until IS NOT NULL AND v_sub.activated_until > now() THEN
      v_activation_ok := true;
    ELSE
      v_activation_ok := false;
    END IF;
  ELSE
    v_activation_ok := false;
  END IF;

  IF NOT v_activation_ok THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'activation_required', 'message', 'Obuna muddati tugagan. To''lovni amalga oshiring.');
  END IF;

  v_discount := COALESCE(v_plan.balance_discount_percent, 0);
  v_tier := COALESCE(v_sub.plan_slug, v_sub.plan_type);

  -- Check if feature is included in plan (free within tier)
  IF v_plan.id IS NOT NULL AND v_plan.included_feature_keys IS NOT NULL 
     AND p_feature_key = ANY(v_plan.included_feature_keys) THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', v_tier);
  END IF;

  -- Calculate discounted price
  v_price := ROUND(v_feature.base_price_uzs * (100 - v_discount) / 100);

  IF v_price > 0 THEN
    SELECT COALESCE(balance_uzs, 0) INTO v_balance FROM user_balances WHERE user_id = p_user_id;
    IF v_balance IS NULL OR v_balance < v_price THEN
      RETURN jsonb_build_object('allowed', false, 'error', 'insufficient_balance', 'price', v_price, 'balance', COALESCE(v_balance, 0),
        'message', 'Balans yetarli emas. Balansni to''ldiring.');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'price', v_price, 'tier', v_tier, 'discount', v_discount, 'billing_type', v_billing_type);
END;
$function$;

-- 4. Update generate_expiry_warnings: Skip free plan users
CREATE OR REPLACE FUNCTION public.generate_expiry_warnings()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sub RECORD;
  v_expiry TIMESTAMP WITH TIME ZONE;
  v_days_left INTEGER;
  v_already_notified BOOLEAN;
  v_plan RECORD;
BEGIN
  FOR v_sub IN 
    SELECT * FROM public.sellercloud_subscriptions WHERE is_active = true
  LOOP
    -- Get plan
    SELECT * INTO v_plan FROM subscription_plans 
    WHERE slug = COALESCE(v_sub.plan_slug, v_sub.plan_type) LIMIT 1;
    
    -- Skip free plan users (they never expire)
    IF v_plan.id IS NOT NULL AND v_plan.monthly_fee_uzs = 0 THEN
      CONTINUE;
    END IF;

    -- Determine expiry (no more trial check)
    v_expiry := GREATEST(
      COALESCE(v_sub.activation_paid_until, '1970-01-01'::timestamptz),
      COALESCE(v_sub.activated_until, '1970-01-01'::timestamptz)
    );
    
    IF v_expiry <= '1970-01-01'::timestamptz THEN
      CONTINUE;
    END IF;

    v_days_left := EXTRACT(DAY FROM (v_expiry - NOW()))::integer;

    IF v_days_left BETWEEN 0 AND 3 THEN
      SELECT EXISTS(
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_sub.user_id 
          AND type = 'subscription'
          AND created_at > NOW() - INTERVAL '20 hours'
          AND title LIKE '%muddati tugaydi%'
      ) INTO v_already_notified;

      IF NOT v_already_notified THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
          v_sub.user_id,
          '⚠️ Obuna muddati tugaydi!',
          'Sizning obuna muddatingiz ' || v_days_left || ' kundan so''ng tugaydi. To''lovni amalga oshiring.',
          'subscription'
        );
      END IF;
    END IF;

    -- Auto-block if expired
    IF v_expiry < NOW() THEN
      UPDATE public.sellercloud_subscriptions 
      SET is_active = false, admin_override = false
      WHERE id = v_sub.id AND is_active = true;
    END IF;
  END LOOP;
END;
$function$;
