
-- 1. Fix user_roles SELECT policy: restrict to authenticated only
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. Fix orders OTP leak: replace seller SELECT policy with one that hides OTP
-- Create a SECURITY DEFINER function that returns orders without OTP for sellers
CREATE OR REPLACE FUNCTION public.seller_order_has_no_otp_access(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.seller_has_order_products(_user_id, _order_id)
$$;

-- Create a view for seller order access that excludes sensitive OTP fields
CREATE OR REPLACE VIEW public.orders_seller_view WITH (security_invoker = true) AS
  SELECT id, user_id, order_number, status, payment_method,
         payment_status, shipping_address, total_amount,
         created_at, updated_at, notes
  FROM orders;

-- Drop the problematic seller SELECT policy on orders
DROP POLICY IF EXISTS "Sellers can view orders with their products" ON public.orders;

-- Recreate seller policy that nullifies OTP columns
-- We can't use column-level security in Postgres RLS, so we use a different approach:
-- Clear the OTP for non-owner access by using a trigger that nullifies on read
-- Actually the best approach is to just drop the direct seller policy and have them use the view

-- 3. Fix logistics_orders: the view already has security_invoker=true and CASE masking
-- but let's ensure there's no open INSERT. The current policies only allow admin INSERT via ALL policy.
-- This is already secure. No change needed.
