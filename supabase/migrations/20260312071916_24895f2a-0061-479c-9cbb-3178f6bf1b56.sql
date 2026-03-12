-- Fix 1: Recreate marketplace_connections_safe view with security_invoker
DROP VIEW IF EXISTS public.marketplace_connections_safe;
CREATE VIEW public.marketplace_connections_safe
WITH (security_invoker = on) AS
SELECT id, user_id, marketplace, shop_id, account_info,
       products_count, orders_count, total_revenue,
       is_active, last_sync_at, created_at, updated_at
FROM public.marketplace_connections;

-- Fix 2: Remove dangerous seller_balances INSERT/UPDATE policies
DROP POLICY IF EXISTS "System can insert balances" ON public.seller_balances;
DROP POLICY IF EXISTS "System can update balances" ON public.seller_balances;

-- Fix 3: Remove dangerous user_balances INSERT policy
DROP POLICY IF EXISTS "Users can insert own balance" ON public.user_balances;