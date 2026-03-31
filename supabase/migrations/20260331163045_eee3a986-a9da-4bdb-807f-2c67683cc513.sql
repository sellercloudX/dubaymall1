
DROP VIEW IF EXISTS public.logistics_orders_safe;

CREATE VIEW public.logistics_orders_safe AS
SELECT 
    id, status, delivery_type, product_name, seller_name, payment_amount,
    created_at, updated_at, tracking_url, target_point_id, barcode,
    status_history, notes, accepted_by, courier_id, accepted_at,
    courier_assigned_at, delivered_at,
    CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
        THEN customer_name ELSE '***' END AS customer_name,
    CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
        THEN customer_phone ELSE '***' END AS customer_phone,
    CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
        THEN customer_address ELSE NULL::text END AS customer_address,
    CASE WHEN (accepted_by = auth.uid() OR courier_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
        THEN customer_telegram ELSE NULL::text END AS customer_telegram
FROM logistics_orders;
