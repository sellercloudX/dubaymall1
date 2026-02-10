
-- Fix 1: commissions — only system (via calculate_order_financials) should insert
DROP POLICY IF EXISTS "Authenticated can insert commissions" ON public.commissions;
CREATE POLICY "System inserts commissions via RPC"
ON public.commissions FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'seller')
);

-- Fix 2: notifications — only the system or admins should insert
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Admins and system insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Fix 3: order_financials — only via calculate_order_financials RPC (admin/seller)
DROP POLICY IF EXISTS "System can insert financials" ON public.order_financials;
CREATE POLICY "Authorized users insert financials"
ON public.order_financials FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'seller')
);

-- Fix 4: platform_revenue — only admins/system
DROP POLICY IF EXISTS "System can insert revenue" ON public.platform_revenue;
CREATE POLICY "Admin inserts platform revenue"
ON public.platform_revenue FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'seller')
);
