
CREATE OR REPLACE FUNCTION public.create_sellercloud_subscription(p_plan_type text, p_monthly_fee numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_existing_id uuid;
  v_sub_id uuid;
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

  -- All plans are paid now, no free access
  INSERT INTO public.sellercloud_subscriptions (
    user_id, plan_type, plan_slug, monthly_fee, commission_percent,
    is_trial, is_active, activation_trial_ends, activation_fee_uzs,
    admin_override, free_access
  ) VALUES (
    v_user_id, p_plan_type, p_plan_type, p_monthly_fee, 0,
    false, true, NULL, 99000,
    false, false
  )
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$;
