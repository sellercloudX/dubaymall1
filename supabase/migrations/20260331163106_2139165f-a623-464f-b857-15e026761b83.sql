
-- Fix SECURITY DEFINER warning on logistics_orders_safe
ALTER VIEW public.logistics_orders_safe SET (security_invoker = on);

-- Fix orders_seller_view: restrict to own orders + set security_invoker
DROP VIEW IF EXISTS public.orders_seller_view;
CREATE VIEW public.orders_seller_view WITH (security_invoker = on) AS
SELECT id, user_id, order_number, status, payment_method, payment_status,
    shipping_address, total_amount, created_at, updated_at, notes
FROM orders
WHERE user_id = auth.uid();

-- Fix wildberries_orders: change public role to authenticated
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.wildberries_orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.wildberries_orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.wildberries_orders;

CREATE POLICY "Users can view their own wb orders" ON public.wildberries_orders
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own wb orders" ON public.wildberries_orders
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own wb orders" ON public.wildberries_orders
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Add DELETE policy on user_roles (admin only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Admins can delete roles') THEN
    CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
    USING (has_role(auth.uid(), 'admin'::user_role));
  END IF;
END $$;

-- Clear plaintext API keys from uzum_accounts
UPDATE public.uzum_accounts SET api_key = NULL, session_token = NULL WHERE api_key IS NOT NULL OR session_token IS NOT NULL;
COMMENT ON COLUMN public.uzum_accounts.api_key IS 'DEPRECATED: Use encrypted_api_key only';
COMMENT ON COLUMN public.uzum_accounts.session_token IS 'DEPRECATED: Do not store plaintext tokens';

-- Remove duplicate logistics_orders policy
DROP POLICY IF EXISTS "Users view own logistics orders" ON public.logistics_orders;
