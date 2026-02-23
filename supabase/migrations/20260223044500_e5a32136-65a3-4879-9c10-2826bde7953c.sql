
-- Tighten INSERT policies on system financial tables
-- Service role (edge functions) and SECURITY DEFINER functions bypass RLS entirely,
-- so these policies only affect direct client inserts via anon/authenticated roles.

-- 1. order_financials: Replace WITH CHECK (true) with admin-only
DROP POLICY IF EXISTS "System can insert financials" ON public.order_financials;
CREATE POLICY "Only admins can insert financials"
ON public.order_financials FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. commissions: Replace WITH CHECK (true) with admin-only
DROP POLICY IF EXISTS "System can insert commissions" ON public.commissions;
CREATE POLICY "Only admins can insert commissions"
ON public.commissions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. sellercloud_billing: Replace WITH CHECK (true) with admin-only
DROP POLICY IF EXISTS "System can insert billing" ON public.sellercloud_billing;
CREATE POLICY "Only admins can insert billing"
ON public.sellercloud_billing FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. platform_revenue: Replace WITH CHECK (true) with admin-only
DROP POLICY IF EXISTS "Anyone can insert platform revenue" ON public.platform_revenue;
DROP POLICY IF EXISTS "System can insert platform revenue" ON public.platform_revenue;
CREATE POLICY "Only admins can insert platform revenue"
ON public.platform_revenue FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));
