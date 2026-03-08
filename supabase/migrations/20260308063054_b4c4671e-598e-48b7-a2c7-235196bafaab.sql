
CREATE OR REPLACE FUNCTION public.check_sellercloud_access(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_total_debt NUMERIC;
  v_has_access BOOLEAN := false;
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

  -- 1. Admin override (always wins)
  IF v_subscription.admin_override = true THEN
    IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until < NOW() THEN
      UPDATE public.sellercloud_subscriptions 
      SET is_active = false, admin_override = false
      WHERE id = v_subscription.id;
      -- fall through to other checks
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

  -- 2. Free access by admin
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

  -- 3. Trial period (1-day activation trial) — SELF-SERVICE, no admin needed
  IF v_subscription.activation_trial_ends IS NOT NULL AND v_subscription.activation_trial_ends > NOW() THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'trial',
      'message', 'Sinov muddati faol',
      'trial_ends_at', v_subscription.activation_trial_ends,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- 4. Paid activation (99k/month) — SELF-SERVICE
  IF v_subscription.activation_paid_until IS NOT NULL AND v_subscription.activation_paid_until > NOW() THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Faol obuna',
      'activated_until', v_subscription.activation_paid_until,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- 5. Legacy activated_until check
  IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until > NOW() AND v_subscription.is_active = true THEN
    RETURN json_build_object(
      'is_active', true,
      'reason', 'active',
      'message', 'Faol obuna',
      'activated_until', v_subscription.activated_until,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- 6. Premium/Elegant always have access
  IF v_subscription.plan_type IN ('premium', 'elegant') AND v_subscription.is_active = true THEN
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

  -- No active access — trial ended, activation needed
  RETURN json_build_object(
    'is_active', false,
    'reason', 'inactive',
    'message', 'Sinov muddati tugagan. Oylik aktivatsiya (99,000 so''m) to''lovini amalga oshiring.',
    'subscription', row_to_json(v_subscription)
  );
END;
$function$;
