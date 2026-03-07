
-- Update check_feature_access to also verify activation status
CREATE OR REPLACE FUNCTION public.check_feature_access(p_user_id uuid, p_feature_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature feature_pricing%ROWTYPE;
  v_balance numeric;
  v_sub sellercloud_subscriptions%ROWTYPE;
  v_usage int;
  v_price numeric;
  v_tier text;
  v_activation_ok boolean := false;
BEGIN
  -- Get feature config
  SELECT * INTO v_feature FROM feature_pricing WHERE feature_key = p_feature_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'unknown');
  END IF;

  -- Feature disabled?
  IF NOT v_feature.is_enabled THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'feature_disabled', 'message', 'Bu funksiya hozircha o''chirilgan');
  END IF;

  -- Free feature?
  IF v_feature.is_free THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'free');
  END IF;

  -- Get subscription
  SELECT * INTO v_sub FROM sellercloud_subscriptions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;

  -- Check activation status (free tier needs activation after trial)
  IF v_sub.id IS NOT NULL THEN
    -- Elegant or admin override = always activated
    IF v_sub.plan_type = 'elegant' OR v_sub.admin_override THEN
      v_activation_ok := true;
    -- Premium = always activated  
    ELSIF v_sub.plan_type = 'premium' THEN
      v_activation_ok := true;
    -- Free/pro tier: check trial or activation payment
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
    -- No subscription at all - not activated
    v_activation_ok := false;
  END IF;

  IF NOT v_activation_ok THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'activation_required', 'message', 'Oylik aktivatsiya (99,000 so''m) talab etiladi. 7 kunlik sinov muddati tugagan.');
  END IF;

  -- Determine tier and price
  IF v_sub.plan_type = 'elegant' THEN
    v_tier := 'elegant';
    v_price := 0;
    -- Check limit
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
    v_price := ROUND(v_feature.base_price_uzs * 0.7); -- 30% discount
  ELSE
    v_tier := 'free';
    v_price := v_feature.base_price_uzs;
  END IF;

  -- Premium only check
  IF v_feature.is_premium_only AND v_tier = 'free' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'premium_only', 'message', 'Bu funksiya faqat Premium/Elegant foydalanuvchilar uchun');
  END IF;

  -- Balance check (skip for elegant with 0 price)
  IF v_price > 0 THEN
    SELECT COALESCE(balance_uzs, 0) INTO v_balance FROM user_balances WHERE user_id = p_user_id;
    IF v_balance IS NULL OR v_balance < v_price THEN
      RETURN jsonb_build_object('allowed', false, 'error', 'insufficient_balance', 'price', v_price, 'balance', COALESCE(v_balance, 0),
        'message', format('Balans yetarli emas. Kamida 300,000 so''m to''ldiring.'));
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'price', v_price, 'tier', v_tier, 'used', COALESCE(v_usage, 0));
END;
$$;
