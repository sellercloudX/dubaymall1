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
  v_usage int;
  v_price numeric;
  v_tier text;
  v_activation_ok boolean := false;
  v_plan record;
  v_discount int := 0;
  v_billing_type text;
  v_monthly_limit int;
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

  -- Get billing type and monthly limit
  v_billing_type := COALESCE(v_feature.billing_type, 'per_use');
  v_monthly_limit := v_feature.monthly_limit;

  SELECT * INTO v_sub FROM sellercloud_subscriptions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;

  IF v_sub.id IS NOT NULL THEN
    IF v_sub.admin_override THEN
      v_activation_ok := true;
    ELSIF v_sub.activation_trial_ends IS NOT NULL AND v_sub.activation_trial_ends > now() THEN
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

  SELECT * INTO v_plan FROM subscription_plans 
  WHERE slug = COALESCE(v_sub.plan_slug, v_sub.plan_type)
  LIMIT 1;

  v_discount := COALESCE(v_plan.balance_discount_percent, 0);
  v_tier := COALESCE(v_sub.plan_slug, v_sub.plan_type);

  -- Check if feature is included free in the plan
  IF v_plan.id IS NOT NULL AND v_plan.included_feature_keys IS NOT NULL 
     AND p_feature_key = ANY(v_plan.included_feature_keys) THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', v_tier);
  END IF;

  -- Check monthly limits for card creation / cloning
  IF p_feature_key IN ('card_creation', 'create_card', 'uzum_card_creation', 'wb_card_creation', 'yandex_card_creation') 
     AND v_plan.free_card_creation_monthly > 0 THEN
    SELECT COALESCE(usage_count, 0) INTO v_usage 
    FROM elegant_usage 
    WHERE user_id = p_user_id AND feature_key = p_feature_key 
      AND usage_month = (date_trunc('month', now()))::date;
    IF COALESCE(v_usage, 0) < v_plan.free_card_creation_monthly THEN
      RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', v_tier, 
        'used', COALESCE(v_usage, 0), 'limit', v_plan.free_card_creation_monthly);
    END IF;
  END IF;

  IF p_feature_key IN ('clone_card', 'card_cloning') AND v_plan.free_cloning_monthly > 0 THEN
    SELECT COALESCE(usage_count, 0) INTO v_usage 
    FROM elegant_usage 
    WHERE user_id = p_user_id AND feature_key = p_feature_key 
      AND usage_month = (date_trunc('month', now()))::date;
    IF COALESCE(v_usage, 0) < v_plan.free_cloning_monthly THEN
      RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', v_tier,
        'used', COALESCE(v_usage, 0), 'limit', v_plan.free_cloning_monthly);
    END IF;
  END IF;

  -- Check elegant_limit (free monthly quota per feature)
  IF v_feature.elegant_limit IS NOT NULL AND v_feature.elegant_limit > 0 THEN
    SELECT COALESCE(usage_count, 0) INTO v_usage 
    FROM elegant_usage 
    WHERE user_id = p_user_id AND feature_key = p_feature_key 
      AND usage_month = (date_trunc('month', now()))::date;
    IF COALESCE(v_usage, 0) < v_feature.elegant_limit THEN
      RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'elegant',
        'used', COALESCE(v_usage, 0), 'limit', v_feature.elegant_limit);
    END IF;
  END IF;

  -- Check monthly_limit for monthly-billed features
  IF v_billing_type = 'monthly' AND v_monthly_limit IS NOT NULL AND v_monthly_limit > 0 THEN
    SELECT COALESCE(usage_count, 0) INTO v_usage 
    FROM elegant_usage 
    WHERE user_id = p_user_id AND feature_key = p_feature_key 
      AND usage_month = (date_trunc('month', now()))::date;
    IF COALESCE(v_usage, 0) >= v_monthly_limit THEN
      RETURN jsonb_build_object('allowed', false, 'error', 'limit_reached', 
        'message', 'Oylik limit tugadi (' || v_monthly_limit || ' ta). Keyingi oyni kuting yoki tarifni oshiring.',
        'used', v_usage, 'limit', v_monthly_limit);
    END IF;
  END IF;

  IF v_feature.is_premium_only AND v_tier = 'starter' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'premium_only', 'message', 'Bu funksiya faqat Business va undan yuqori tariflar uchun');
  END IF;

  -- Calculate price with discount
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