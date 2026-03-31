
-- =============================================
-- 1. Fix logistics_orders: restrict admin policy to authenticated only
-- =============================================
DROP POLICY IF EXISTS "Admins can manage logistics orders" ON public.logistics_orders;
CREATE POLICY "Admins can manage logistics orders"
  ON public.logistics_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- =============================================
-- 2. Fix reviews: remove anon access to base table
-- =============================================
DROP POLICY IF EXISTS "Anyone can view reviews via public view" ON public.reviews;

-- Add authenticated-only SELECT for app functionality
CREATE POLICY "Authenticated can view all reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (true);

-- =============================================
-- 3. Fix user_roles: tighten can_add_role to only allow 'buyer'
-- =============================================
CREATE OR REPLACE FUNCTION public.can_add_role(p_user_id uuid, p_new_role user_role)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := public.has_role(p_user_id, 'admin');
  IF v_is_admin THEN RETURN TRUE; END IF;
  -- Non-admins can ONLY self-assign 'buyer' role, nothing else
  IF p_new_role != 'buyer' THEN RETURN FALSE; END IF;
  -- Prevent duplicate
  IF public.has_role(p_user_id, 'buyer') THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

-- =============================================
-- 4. Fix shops_public: recreate with security_invoker=true
-- =============================================
DROP VIEW IF EXISTS public.shops_public;
CREATE VIEW public.shops_public WITH (security_invoker = true) AS
  SELECT id, name, slug, description, logo_url, banner_url,
         rating, total_sales, is_active, created_at, updated_at
  FROM public.shops
  WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.shops_public TO anon, authenticated;
