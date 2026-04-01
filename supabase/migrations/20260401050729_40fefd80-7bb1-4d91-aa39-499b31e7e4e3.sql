
-- Fix 1: Make logistics_orders_safe view use security invoker
CREATE OR REPLACE VIEW public.logistics_orders_safe WITH (security_invoker = true) AS
SELECT 
  id, status, delivery_type, product_name, seller_name, payment_amount,
  created_at, updated_at, tracking_url, target_point_id, barcode,
  status_history, notes, accepted_by, courier_id, accepted_at,
  courier_assigned_at, delivered_at,
  CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role)) THEN customer_name ELSE '***'::text END AS customer_name,
  CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role)) THEN customer_phone ELSE '***'::text END AS customer_phone,
  CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role)) THEN customer_address ELSE NULL::text END AS customer_address,
  CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role)) THEN customer_telegram ELSE NULL::text END AS customer_telegram
FROM logistics_orders;

-- Fix 2: Replace overly permissive team_members UPDATE policy
DROP POLICY IF EXISTS "Members update their own membership" ON public.team_members;

-- Members can only update their own status (accept/decline invites), not role or permissions
CREATE POLICY "Members can accept or decline invites"
ON public.team_members
FOR UPDATE
TO authenticated
USING (member_user_id = auth.uid())
WITH CHECK (
  member_user_id = auth.uid()
  AND role = (SELECT t.role FROM public.team_members t WHERE t.id = team_members.id)
  AND permissions = (SELECT t.permissions FROM public.team_members t WHERE t.id = team_members.id)
  AND owner_user_id = (SELECT t.owner_user_id FROM public.team_members t WHERE t.id = team_members.id)
);
