
CREATE OR REPLACE FUNCTION public.check_feature_access(p_user_id uuid, p_feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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

  -- Get subscription and plan info first (needed for premium_only check)
  SELECT * INTO v_sub FROM sellercloud_subscriptions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;

  SELECT * INTO v_plan FROM subscription_plans 
  WHERE slug = COALESCE(v_sub.plan_slug, v_sub.plan_type)
  LIMIT 1;

  -- If feature is premium_only, check plan inclusion BEFORE is_free check
  IF v_feature.is_premium_only THEN
    -- Must have a plan that includes this feature
    IF v_plan.id IS NULL 
       OR v_plan.included_feature_keys IS NULL 
       OR NOT (p_feature_key = ANY(v_plan.included_feature_keys)) THEN
      RETURN jsonb_build_object(
        'allowed', false, 
        'error', 'premium_only', 
        'message', 'Bu funksiya faqat yuqori tariflar uchun. Tarifni oshiring.'
      );
    END IF;
  END IF;

  -- Free features (non-premium) are always allowed
  IF v_feature.is_free AND NOT v_feature.is_premium_only THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'free');
  END IF;

  v_billing_type := COALESCE(v_feature.billing_type, 'per_use');

  -- Determine activation status
  IF v_sub.id IS NOT NULL THEN
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

  -- Premium-only features that passed the plan check above are allowed at price 0
  IF v_feature.is_premium_only AND v_feature.is_free THEN
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
$$;
