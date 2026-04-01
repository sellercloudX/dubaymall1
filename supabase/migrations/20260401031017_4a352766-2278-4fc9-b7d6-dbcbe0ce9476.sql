-- Replace self-insert policy with a SECURITY DEFINER function
-- This prevents any race condition or enum-change escalation risk

-- 1. Drop the problematic self-insert policy
DROP POLICY IF EXISTS "Users can add single role to themselves" ON public.user_roles;

-- 2. Create a SECURITY DEFINER function that only allows assigning 'buyer' role
CREATE OR REPLACE FUNCTION public.assign_buyer_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow self-assignment
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot assign roles to other users';
  END IF;

  -- Only allow 'buyer' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- 3. Revoke execute from anon, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.assign_buyer_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_buyer_role(uuid) TO authenticated;
