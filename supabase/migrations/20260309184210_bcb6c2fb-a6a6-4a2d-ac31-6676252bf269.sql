
-- Drop all overly permissive SELECT policies on logistics_orders
DROP POLICY IF EXISTS "Public can read logistics orders for tracking" ON public.logistics_orders;
DROP POLICY IF EXISTS "Authenticated users can view own logistics orders" ON public.logistics_orders;
DROP POLICY IF EXISTS "Sellers can view their logistics orders" ON public.logistics_orders;

-- Scoped policy: couriers/accepted_by can see their own assigned orders
CREATE POLICY "Users view own logistics orders"
ON public.logistics_orders FOR SELECT TO authenticated
USING (
  accepted_by = auth.uid() 
  OR courier_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);
