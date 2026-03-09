
-- 1. Update check_sellercloud_access to be STRICT - no freemium, hard block after expiry
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
      'message', 'Obuna mavjud emas. Ro''yxatdan o''ting.',
      'blocked', true
    );
  END IF;

  -- Determine the effective expiry date (single source of truth)
  v_expiry := NULL;

  -- 1. Admin override with strict duration
  IF v_subscription.admin_override = true THEN
    IF v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until > NOW() THEN
      v_expiry := v_subscription.activated_until;
    ELSE
      -- Admin activation expired — deactivate
      UPDATE public.sellercloud_subscriptions 
      SET is_active = false, admin_override = false
      WHERE id = v_subscription.id;
      -- Fall through to blocked
    END IF;
  END IF;

  -- 2. Trial period (strict)
  IF v_expiry IS NULL AND v_subscription.activation_trial_ends IS NOT NULL AND v_subscription.activation_trial_ends > NOW() THEN
    v_expiry := v_subscription.activation_trial_ends;
  END IF;

  -- 3. Paid activation (strict)
  IF v_expiry IS NULL AND v_subscription.activation_paid_until IS NOT NULL AND v_subscription.activation_paid_until > NOW() THEN
    v_expiry := v_subscription.activation_paid_until;
  END IF;

  -- 4. Legacy activated_until
  IF v_expiry IS NULL AND v_subscription.activated_until IS NOT NULL AND v_subscription.activated_until > NOW() THEN
    v_expiry := v_subscription.activated_until;
  END IF;

  -- If we found a valid expiry, user has access
  IF v_expiry IS NOT NULL THEN
    v_days_left := EXTRACT(DAY FROM (v_expiry - NOW()))::integer;
    
    -- Ensure subscription is marked active
    IF NOT v_subscription.is_active THEN
      UPDATE public.sellercloud_subscriptions SET is_active = true WHERE id = v_subscription.id;
    END IF;

    RETURN json_build_object(
      'is_active', true,
      'reason', CASE 
        WHEN v_subscription.admin_override THEN 'admin_override'
        WHEN v_subscription.activation_trial_ends IS NOT NULL AND v_subscription.activation_trial_ends > NOW() THEN 'trial'
        ELSE 'active'
      END,
      'message', CASE 
        WHEN v_days_left <= 3 THEN 'Diqqat! Obuna muddati ' || v_days_left || ' kundan so''ng tugaydi. To''lovni amalga oshiring!'
        ELSE 'Faol obuna'
      END,
      'blocked', false,
      'expires_at', v_expiry,
      'days_left', v_days_left,
      'warning', v_days_left <= 3,
      'subscription', row_to_json(v_subscription)
    );
  END IF;

  -- NO VALID EXPIRY = BLOCKED. No freemium, no debt access.
  -- Mark subscription as inactive
  IF v_subscription.is_active THEN
    UPDATE public.sellercloud_subscriptions SET is_active = false WHERE id = v_subscription.id;
  END IF;

  RETURN json_build_object(
    'is_active', false,
    'reason', 'expired',
    'message', 'Obuna muddati tugagan. Davom etish uchun to''lovni amalga oshiring.',
    'blocked', true,
    'subscription', row_to_json(v_subscription)
  );
END;
$function$;

-- 2. Create function to generate expiry warning notifications (called by cron)
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
BEGIN
  FOR v_sub IN 
    SELECT * FROM public.sellercloud_subscriptions WHERE is_active = true
  LOOP
    -- Determine expiry
    v_expiry := GREATEST(
      COALESCE(v_sub.activation_paid_until, '1970-01-01'::timestamptz),
      COALESCE(v_sub.activated_until, '1970-01-01'::timestamptz),
      COALESCE(v_sub.activation_trial_ends, '1970-01-01'::timestamptz)
    );
    
    IF v_expiry <= '1970-01-01'::timestamptz THEN
      CONTINUE;
    END IF;

    v_days_left := EXTRACT(DAY FROM (v_expiry - NOW()))::integer;

    -- Send warning if 3 days or less remain
    IF v_days_left BETWEEN 0 AND 3 THEN
      -- Check if already notified today
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
          'Sizning obuna muddatingiz ' || v_days_left || ' kundan so''ng tugaydi. To''lovni amalga oshiring, aks holda akkaunt bloklanadiǃ',
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

-- 3. Schedule cron job to run daily at 9:00 AM Tashkent time (04:00 UTC)
SELECT cron.schedule(
  'check-subscription-expiry',
  '0 4 * * *',
  $$SELECT public.generate_expiry_warnings()$$
);
