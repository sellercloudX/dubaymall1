
-- Fix check_sellercloud_access: add 'enterprise' to premium/elegant check (step 6)
CREATE OR REPLACE FUNCTION public.check_sellercloud_access(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_total_debt NUMERIC;
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
      'message', 'Obuna mavjud emas. Ro''yxatdan o''ting.'
    );
  END IF;

  -- 1. Admin override
  IF v_subscription.admin_override = true THEN
    IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until < NOW() THEN
      UPDATE public.sellercloud_subscriptions 
      SET is_active = false, admin_override = false
      WHERE id = v_subscription.id;
    ELSE
      RETURN json_build_object(
        'is_active', true,
        'reason', 'admin_override',
        'message', 'Admin tomonidan aktivlashtirilgan',
        'activated_until', v_subscription.activated_until,
        'subscription', row_to_json(v_subscription)
      );
    END IF;
  END IF;

  -- 2. Free access
  IF v_subscription.free_access = true THEN
    IF v_subscription.activated_until IS NULL OR v_subscription.activated_until > NOW() THEN
      RETURN json_build_object(
        'is_active', true,
        'reason', 'admin_override',
        'message', 'Bepul foydalanish',
        'activated_until', v_subscription.activated_until,
        'subscription', row_to_json(v_subscription)
      );
    END IF;
  END IF;

  -- 3. Trial period
  IF v_subscription.activation_trial_ends IS NOT NULL AND v_subscription.activation_trial_ends > NOW() THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'trial',
      'message', 'Sinov muddati faol',
      'trial_ends_at', v_subscription.activation_trial_ends,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- 4. Paid activation
  IF v_subscription.activation_paid_until IS NOT NULL AND v_subscription.activation_paid_until > NOW() THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Faol obuna',
      'activated_until', v_subscription.activation_paid_until,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- 5. Legacy activated_until
  IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until > NOW() AND v_subscription.is_active = true THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Faol obuna',
      'activated_until', v_subscription.activated_until,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- 6. Premium/Elegant/Enterprise always have access when active
  IF v_subscription.plan_type IN ('premium', 'elegant', 'enterprise') AND v_subscription.is_active = true THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Premium/Elegant obuna faol',
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- 7. Check debt
  SELECT COALESCE(SUM(balance_due), 0) INTO v_total_debt
  FROM public.sellercloud_billing
  WHERE user_id = p_user_id AND status IN ('pending', 'overdue');

  IF v_total_debt > 0 THEN
    RETURN json_build_object(
      'is_active', false,
      'reason', 'debt',
      'message', 'Qarzdorlik mavjud: ' || v_total_debt || ' so''m. To''lov qiling.',
      'total_debt', v_total_debt,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  RETURN json_build_object(
    'is_active', false,
    'reason', 'inactive',
    'message', 'Sinov muddati tugagan. Oylik aktivatsiya (99,000 so''m) to''lovini amalga oshiring.',
    'subscription', row_to_json(v_subscription)
  );
END;
$function$;

-- Fix check_feature_access: treat 'enterprise' same as 'elegant'
CREATE OR REPLACE FUNCTION public.check_feature_access(p_user_id uuid, p_feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_feature feature_pricing%ROWTYPE;
  v_balance numeric;
  v_sub sellercloud_subscriptions%ROWTYPE;
  v_usage int;
  v_price numeric;
  v_tier text;
  v_activation_ok boolean := false;
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

  SELECT * INTO v_sub FROM sellercloud_subscriptions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;

  IF v_sub.id IS NOT NULL THEN
    -- enterprise = elegant in our system
    IF v_sub.plan_type IN ('elegant', 'enterprise') OR v_sub.admin_override THEN
      v_activation_ok := true;
    ELSIF v_sub.plan_type = 'premium' THEN
      v_activation_ok := true;
    ELSE
      IF v_sub.activation_trial_ends IS NOT NULL AND v_sub.activation_trial_ends > now() THEN
        v_activation_ok := true;
      ELSIF v_sub.activation_paid_until IS NOT NULL AND v_sub.activation_paid_until > now() THEN
        v_activation_ok := true;
      ELSE
        v_activation_ok := false;
      END IF;
    END IF;
  ELSE
    v_activation_ok := false;
  END IF;

  IF NOT v_activation_ok THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'activation_required', 'message', 'Oylik aktivatsiya (99,000 so''m) talab etiladi. 1 kunlik sinov muddati tugagan.');
  END IF;

  -- enterprise = elegant for tier determination
  IF v_sub.plan_type IN ('elegant', 'enterprise') THEN
    v_tier := 'elegant';
    v_price := 0;
    IF v_feature.elegant_limit IS NOT NULL THEN
      SELECT COALESCE(usage_count, 0) INTO v_usage 
      FROM elegant_usage 
      WHERE user_id = p_user_id AND feature_key = p_feature_key 
        AND usage_month = (date_trunc('month', now()))::date;
      IF v_usage >= v_feature.elegant_limit THEN
        RETURN jsonb_build_object('allowed', false, 'error', 'limit_reached', 'message', 
          format('Oylik limit tugadi: %s/%s', v_usage, v_feature.elegant_limit), 'used', v_usage, 'limit', v_feature.elegant_limit);
      END IF;
    END IF;
  ELSIF v_sub.plan_type = 'premium' THEN
    v_tier := 'premium';
    v_price := ROUND(v_feature.base_price_uzs * 0.6);
  ELSE
    v_tier := 'free';
    v_price := v_feature.base_price_uzs;
  END IF;

  IF v_feature.is_premium_only AND v_tier = 'free' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'premium_only', 'message', 'Bu funksiya faqat Premium/Elegant foydalanuvchilar uchun');
  END IF;

  IF v_price > 0 THEN
    SELECT COALESCE(balance_uzs, 0) INTO v_balance FROM user_balances WHERE user_id = p_user_id;
    IF v_balance IS NULL OR v_balance < v_price THEN
      RETURN jsonb_build_object('allowed', false, 'error', 'insufficient_balance', 'price', v_price, 'balance', COALESCE(v_balance, 0),
        'message', 'Balans yetarli emas. Balansni to''ldiring.');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'price', v_price, 'tier', v_tier, 'used', COALESCE(v_usage, 0));
END;
$function$;
