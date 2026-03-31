
-- =============================================
-- FIX 1: reviews_public view - add security_invoker to enforce RLS
-- =============================================
DROP VIEW IF EXISTS public.reviews_public;
CREATE VIEW public.reviews_public WITH (security_invoker = true) AS
SELECT 
  r.id,
  r.product_id,
  r.rating,
  r.comment,
  r.is_verified_purchase,
  r.created_at,
  r.updated_at,
  p.full_name AS reviewer_name,
  p.avatar_url AS reviewer_avatar
FROM reviews r
LEFT JOIN profiles p ON p.user_id = r.user_id;

-- Add a public SELECT policy on reviews so reviews_public works for everyone
CREATE POLICY "Anyone can view reviews via public view"
ON public.reviews FOR SELECT
TO anon, authenticated
USING (true);

-- =============================================
-- FIX 2: logistics_orders - restrict OTP/confirmation_code from non-admin/non-courier
-- Create a safe view that hides sensitive fields
-- =============================================
CREATE OR REPLACE VIEW public.logistics_orders_safe WITH (security_invoker = true) AS
SELECT 
  id, barcode, status, delivery_type,
  customer_name, customer_phone,
  product_name, seller_name,
  payment_amount, notes,
  tracking_url, target_point_id,
  created_at, updated_at,
  accepted_at, delivered_at,
  courier_assigned_at, status_history,
  -- Only show OTP/confirmation_code to admins and assigned courier
  CASE WHEN (courier_id = auth.uid() OR accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN delivery_otp ELSE NULL END AS delivery_otp,
  CASE WHEN (courier_id = auth.uid() OR accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN confirmation_code ELSE NULL END AS confirmation_code,
  CASE WHEN (courier_id = auth.uid() OR accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN customer_address ELSE NULL END AS customer_address,
  CASE WHEN (courier_id = auth.uid() OR accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN customer_telegram ELSE NULL END AS customer_telegram,
  courier_id, accepted_by
FROM public.logistics_orders;

-- =============================================
-- FIX 3: user_roles - change INSERT policies from {public} to {authenticated}
-- =============================================
DROP POLICY IF EXISTS "Users can add single role to themselves" ON public.user_roles;
CREATE POLICY "Users can add single role to themselves"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND can_add_role(auth.uid(), role));

DROP POLICY IF EXISTS "Admins can add any role" ON public.user_roles;
CREATE POLICY "Admins can add any role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- =============================================
-- FIX 4: shops - restrict anon access to shops_public view only
-- Drop the overly permissive policy that exposes user_id to anon
-- =============================================
DROP POLICY IF EXISTS "Anyone can view active shop public info" ON public.shops;

-- Re-create it for authenticated users only (owners, sellers, admins already have their own policies)
CREATE POLICY "Authenticated can view active shops"
ON public.shops FOR SELECT
TO authenticated
USING (is_active = true);

-- Grant anon access only through shops_public view (which doesn't include user_id)
DROP VIEW IF EXISTS public.shops_public;
CREATE VIEW public.shops_public WITH (security_invoker = false) AS
SELECT id, name, slug, description, logo_url, banner_url, rating, total_sales, is_active, created_at, updated_at
FROM public.shops
WHERE is_active = true;

GRANT SELECT ON public.shops_public TO anon, authenticated;
