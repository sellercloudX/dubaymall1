
-- ============================================================
-- FIX 1 & 5: Remove base64 fallback from encrypt/decrypt functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.encrypt_credentials(p_credentials jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.settings.credentials_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set CREDENTIALS_ENCRYPTION_KEY in secrets.';
  END IF;
  RETURN encode(
    pgp_sym_encrypt(p_credentials::text, v_key),
    'base64'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_credentials(p_encrypted text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_decrypted text;
BEGIN
  v_key := current_setting('app.settings.credentials_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set CREDENTIALS_ENCRYPTION_KEY in secrets.';
  END IF;
  v_decrypted := pgp_sym_decrypt(
    decode(p_encrypted, 'base64'),
    v_key
  );
  RETURN v_decrypted::jsonb;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to decrypt credentials. Key may be incorrect or data corrupted.';
END;
$function$;

-- ============================================================
-- FIX 2: Add auth checks to financial SECURITY DEFINER functions
-- ============================================================

-- process_pending_payouts: restrict to admin only
CREATE OR REPLACE FUNCTION public.process_pending_payouts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_record RECORD;
BEGIN
  -- Authorization: only admins can process payouts
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only admins can process payouts';
  END IF;

  -- Process seller payouts (10 days after delivery)
  FOR v_record IN 
    SELECT of.id, of.shop_id, of.seller_profit
    FROM order_financials of
    JOIN orders o ON o.id = of.order_id
    WHERE of.payout_status = 'pending'
      AND o.delivery_confirmed_at IS NOT NULL
      AND o.status NOT IN ('cancelled', 'returned', 'refunded')
      AND of.payout_available_at <= now()
  LOOP
    UPDATE order_financials SET payout_status = 'ready' WHERE id = v_record.id;
    
    INSERT INTO seller_balances (shop_id, available_balance, total_earned)
    VALUES (v_record.shop_id, v_record.seller_profit, v_record.seller_profit)
    ON CONFLICT (shop_id) DO UPDATE SET
      available_balance = seller_balances.available_balance + v_record.seller_profit,
      pending_balance = GREATEST(0, seller_balances.pending_balance - v_record.seller_profit);
    
    v_count := v_count + 1;
  END LOOP;

  FOR v_record IN
    SELECT c.id, c.blogger_id, c.commission_amount
    FROM commissions c
    JOIN orders o ON o.id = c.order_id
    WHERE c.status = 'pending'
      AND o.delivery_confirmed_at IS NOT NULL
      AND o.status NOT IN ('cancelled', 'returned', 'refunded')
      AND o.delivery_confirmed_at + INTERVAL '10 days' <= now()
  LOOP
    UPDATE commissions SET status = 'available' WHERE id = v_record.id;
    
    UPDATE blogger_balances
    SET 
      available_balance = available_balance + v_record.commission_amount,
      pending_balance = GREATEST(0, pending_balance - v_record.commission_amount)
    WHERE user_id = v_record.blogger_id;
    
    v_count := v_count + 1;
  END LOOP;

  UPDATE commissions c
  SET status = 'cancelled'
  FROM orders o
  WHERE c.order_id = o.id
    AND c.status = 'pending'
    AND o.status IN ('cancelled', 'returned', 'refunded');

  UPDATE blogger_balances bb
  SET pending_balance = GREATEST(0, pending_balance - COALESCE((
    SELECT SUM(commission_amount) 
    FROM commissions 
    WHERE blogger_id = bb.user_id AND status = 'cancelled'
  ), 0));

  RETURN v_count;
END;
$function$;

-- activate_subscription_by_payment: restrict to admin or service role
CREATE OR REPLACE FUNCTION public.activate_subscription_by_payment(p_subscription_id uuid, p_months integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_until TIMESTAMP WITH TIME ZONE;
  v_sub_user_id UUID;
BEGIN
  -- Get subscription owner
  SELECT user_id, activated_until INTO v_sub_user_id, v_current_until
  FROM public.sellercloud_subscriptions
  WHERE id = p_subscription_id;

  IF v_sub_user_id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Authorization: caller must be admin or subscription owner
  IF auth.uid() IS NOT NULL 
     AND NOT public.has_role(auth.uid(), 'admin')
     AND auth.uid() != v_sub_user_id
  THEN
    RAISE EXCEPTION 'Unauthorized: cannot activate this subscription';
  END IF;

  IF v_current_until IS NOT NULL AND v_current_until > NOW() THEN
    UPDATE public.sellercloud_subscriptions
    SET is_active = true,
        activated_until = v_current_until + (p_months || ' months')::interval,
        initial_payment_completed = true,
        initial_payment_at = COALESCE(initial_payment_at, NOW()),
        updated_at = NOW()
    WHERE id = p_subscription_id;
  ELSE
    UPDATE public.sellercloud_subscriptions
    SET is_active = true,
        activated_until = NOW() + (p_months || ' months')::interval,
        initial_payment_completed = true,
        initial_payment_at = COALESCE(initial_payment_at, NOW()),
        updated_at = NOW()
    WHERE id = p_subscription_id;
  END IF;
END;
$function$;

-- ============================================================
-- FIX 3: Create atomic admin management function
-- ============================================================

CREATE OR REPLACE FUNCTION public.manage_admin(
  p_action text,
  p_target_user_id uuid,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify caller is super admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can manage admins';
  END IF;

  -- Prevent self-modification
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify own admin permissions';
  END IF;

  IF p_action = 'add' THEN
    -- Atomic: add role + permissions in one transaction
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.admin_permissions (
      user_id, granted_by,
      can_manage_users, can_manage_products, can_manage_orders,
      can_manage_shops, can_manage_activations, can_manage_finances,
      can_manage_content, can_add_admins, is_super_admin
    ) VALUES (
      p_target_user_id, auth.uid(),
      COALESCE((p_permissions->>'can_manage_users')::boolean, false),
      COALESCE((p_permissions->>'can_manage_products')::boolean, false),
      COALESCE((p_permissions->>'can_manage_orders')::boolean, false),
      COALESCE((p_permissions->>'can_manage_shops')::boolean, false),
      COALESCE((p_permissions->>'can_manage_activations')::boolean, false),
      COALESCE((p_permissions->>'can_manage_finances')::boolean, false),
      COALESCE((p_permissions->>'can_manage_content')::boolean, false),
      COALESCE((p_permissions->>'can_add_admins')::boolean, false),
      false -- never grant super_admin via this function
    );

    RETURN jsonb_build_object('success', true, 'action', 'added');

  ELSIF p_action = 'update' THEN
    UPDATE public.admin_permissions SET
      can_manage_users = COALESCE((p_permissions->>'can_manage_users')::boolean, can_manage_users),
      can_manage_products = COALESCE((p_permissions->>'can_manage_products')::boolean, can_manage_products),
      can_manage_orders = COALESCE((p_permissions->>'can_manage_orders')::boolean, can_manage_orders),
      can_manage_shops = COALESCE((p_permissions->>'can_manage_shops')::boolean, can_manage_shops),
      can_manage_activations = COALESCE((p_permissions->>'can_manage_activations')::boolean, can_manage_activations),
      can_manage_finances = COALESCE((p_permissions->>'can_manage_finances')::boolean, can_manage_finances),
      can_manage_content = COALESCE((p_permissions->>'can_manage_content')::boolean, can_manage_content),
      can_add_admins = COALESCE((p_permissions->>'can_add_admins')::boolean, can_add_admins),
      updated_at = now()
    WHERE user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'action', 'updated');

  ELSIF p_action = 'remove' THEN
    -- Prevent removing super admins
    IF public.is_super_admin(p_target_user_id) THEN
      RAISE EXCEPTION 'Cannot remove a super admin';
    END IF;

    DELETE FROM public.admin_permissions WHERE user_id = p_target_user_id;
    DELETE FROM public.user_roles WHERE user_id = p_target_user_id AND role = 'admin';

    RETURN jsonb_build_object('success', true, 'action', 'removed');

  ELSE
    RAISE EXCEPTION 'Invalid action: %. Use add, update, or remove.', p_action;
  END IF;
END;
$function$;
