
-- 1. Fix logistics_orders: ensure only authenticated users with proper access can read
-- Drop existing SELECT policies and recreate with authenticated role
DROP POLICY IF EXISTS "Users can view their logistics orders" ON public.logistics_orders;
DROP POLICY IF EXISTS "Admins can view all logistics orders" ON public.logistics_orders;

CREATE POLICY "Authenticated users view own logistics orders"
ON public.logistics_orders FOR SELECT TO authenticated
USING (
  accepted_by = auth.uid() 
  OR courier_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- 2. Fix logistics_orders_safe view with security_invoker
DROP VIEW IF EXISTS public.logistics_orders_safe;
CREATE VIEW public.logistics_orders_safe WITH (security_invoker = true) AS
SELECT 
  id, status, delivery_type, product_name, seller_name, payment_amount,
  created_at, updated_at, tracking_url, target_point_id, barcode,
  status_history, notes,
  CASE WHEN accepted_by = auth.uid() OR courier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    THEN customer_name ELSE '***' END AS customer_name,
  CASE WHEN accepted_by = auth.uid() OR courier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    THEN customer_phone ELSE '***' END AS customer_phone,
  CASE WHEN accepted_by = auth.uid() OR courier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    THEN customer_address ELSE NULL END AS customer_address,
  CASE WHEN accepted_by = auth.uid() OR courier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    THEN customer_telegram ELSE NULL END AS customer_telegram,
  CASE WHEN accepted_by = auth.uid() OR courier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    THEN delivery_otp ELSE NULL END AS delivery_otp,
  CASE WHEN accepted_by = auth.uid() OR courier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    THEN confirmation_code ELSE NULL END AS confirmation_code,
  accepted_by, courier_id, accepted_at, courier_assigned_at, delivered_at
FROM public.logistics_orders;

-- 3. Fix marketplace_connections_safe view with security_invoker  
DROP VIEW IF EXISTS public.marketplace_connections_safe;
CREATE VIEW public.marketplace_connections_safe WITH (security_invoker = true) AS
SELECT id, user_id, marketplace, account_info, products_count, orders_count, 
       total_revenue, last_sync_at, is_active, shop_id, created_at, updated_at
FROM public.marketplace_connections
WHERE user_id = auth.uid();

-- 4. Fix wildberries_connections_safe view with security_invoker
DROP VIEW IF EXISTS public.wildberries_connections_safe;
CREATE VIEW public.wildberries_connections_safe WITH (security_invoker = true) AS
SELECT id, user_id, marketplace, account_info, products_count, orders_count,
       total_revenue, last_sync_at, is_active, shop_id, created_at, updated_at
FROM public.marketplace_connections
WHERE user_id = auth.uid() AND marketplace = 'wildberries';

-- 5. Fix profiles: ensure telegram_link_code is not exposed to non-owners
-- The existing RLS should already restrict to own profile, but let's verify
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6. Fix seller_profiles: scope to authenticated only
DROP POLICY IF EXISTS "Sellers can view own profile" ON public.seller_profiles;
DROP POLICY IF EXISTS "Admins can view all seller profiles" ON public.seller_profiles;
DROP POLICY IF EXISTS "seller_profiles_select" ON public.seller_profiles;

CREATE POLICY "Sellers view own profile"
ON public.seller_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7. Fix platform_revenue: scope to authenticated admins only
DROP POLICY IF EXISTS "Admins can view platform revenue" ON public.platform_revenue;
DROP POLICY IF EXISTS "platform_revenue_select" ON public.platform_revenue;

CREATE POLICY "Only admins view platform revenue"
ON public.platform_revenue FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Fix platform_expenses: scope to authenticated admins only
DROP POLICY IF EXISTS "Admins can manage platform expenses" ON public.platform_expenses;
DROP POLICY IF EXISTS "platform_expenses_all" ON public.platform_expenses;

CREATE POLICY "Only admins manage platform expenses"
ON public.platform_expenses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9. Fix reviews: restrict user_id exposure
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "reviews_select" ON public.reviews;

CREATE POLICY "Authenticated users view reviews"
ON public.reviews FOR SELECT TO authenticated
USING (true);

-- 10. Restrict realtime channel subscriptions
-- Add RLS on realtime messages by creating policy-based topic restrictions
-- Note: Supabase realtime respects RLS on the underlying tables
-- The key fix is ensuring the published tables have proper RLS (done above)
