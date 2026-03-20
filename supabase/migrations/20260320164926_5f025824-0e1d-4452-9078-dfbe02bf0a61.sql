CREATE OR REPLACE FUNCTION public.create_sellercloud_subscription(p_plan_type text, p_monthly_fee numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    user_id, plan_type, plan_slug, monthly_fee, commission_percent,
    is_trial, is_active, activation_trial_ends, activation_fee_uzs,
    admin_override, free_access
  ) VALUES (
    v_user_id, p_plan_type, p_plan_type, p_monthly_fee, 0,
    true, true, v_trial_end, 99000,
    false, false
  )
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END;
$function$;