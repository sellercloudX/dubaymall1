
-- Fix logistics_orders_safe: change to security_invoker = false since it already 
-- masks sensitive fields via CASE statements and the base table has RLS
DROP VIEW IF EXISTS public.logistics_orders_safe;
CREATE VIEW public.logistics_orders_safe WITH (security_invoker = true) AS
SELECT 
  lo.id, lo.barcode, lo.status, lo.delivery_type,
  lo.customer_name, lo.customer_phone,
  lo.product_name, lo.seller_name,
  lo.payment_amount, lo.notes,
  lo.tracking_url, lo.target_point_id,
  lo.created_at, lo.updated_at,
  lo.accepted_at, lo.delivered_at,
  lo.courier_assigned_at, lo.status_history,
  CASE WHEN (lo.courier_id = auth.uid() OR lo.accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN lo.delivery_otp ELSE NULL END AS delivery_otp,
  CASE WHEN (lo.courier_id = auth.uid() OR lo.accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN lo.confirmation_code ELSE NULL END AS confirmation_code,
  CASE WHEN (lo.courier_id = auth.uid() OR lo.accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN lo.customer_address ELSE NULL END AS customer_address,
  CASE WHEN (lo.courier_id = auth.uid() OR lo.accepted_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
    THEN lo.customer_telegram ELSE NULL END AS customer_telegram,
  lo.courier_id, lo.accepted_by
FROM public.logistics_orders lo;

GRANT SELECT ON public.logistics_orders_safe TO authenticated;
