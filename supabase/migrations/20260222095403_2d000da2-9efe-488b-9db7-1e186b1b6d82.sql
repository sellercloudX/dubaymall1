
-- Remove legacy DubayMall column from logistics_orders
ALTER TABLE public.logistics_orders DROP COLUMN IF EXISTS dubaymall_order_id;

-- Update table comment to remove DubayMall reference
COMMENT ON TABLE public.logistics_orders IS 'Logistics orders for delivery management';
