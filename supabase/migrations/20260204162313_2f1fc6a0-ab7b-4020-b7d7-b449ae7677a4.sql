-- Remove trial logic from check_sellercloud_access function
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
      'message', 'Premium foydalanuvchi',
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
    'message', 'Obuna faol emas. Admin tasdiqlashi kutilmoqda.',
    'subscription', row_to_json(v_subscription)
  );
END;
$function$;