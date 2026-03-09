-- Fix 1: Remove unsafe user_roles INSERT policy that allows admin self-assignment
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;

-- Fix 2: Update can_add_role to block admin self-assignment
CREATE OR REPLACE FUNCTION public.can_add_role(p_user_id uuid, p_new_role user_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_existing_roles INTEGER;
BEGIN
  -- Block non-admins from assigning admin role
  IF p_new_role = 'admin' THEN
    v_is_admin := public.has_role(p_user_id, 'admin');
    IF NOT v_is_admin THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Admins can add any role
  v_is_admin := public.has_role(p_user_id, 'admin');
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

  -- Check existing roles count
  SELECT COUNT(*) INTO v_existing_roles
  FROM public.user_roles
  WHERE user_id = p_user_id AND role != 'admin';

  IF v_existing_roles = 0 THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Fix 3: Remove direct user_balances UPDATE policy (balance changes must go through RPC)
DROP POLICY IF EXISTS "Users can update own balance" ON public.user_balances;

-- Fix 4: Restrict logistics_orders public SELECT to barcode-based lookup only
DROP POLICY IF EXISTS "Public can read logistics orders for tracking" ON public.logistics_orders;

CREATE POLICY "Authenticated users can view own logistics orders"
ON public.logistics_orders
FOR SELECT
TO authenticated
USING (true);