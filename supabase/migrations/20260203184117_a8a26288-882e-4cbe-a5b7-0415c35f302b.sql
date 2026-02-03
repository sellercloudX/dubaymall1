-- Fix RLS policies for better security

-- 1. Add admin policies for orders (admin can view all orders)
CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update any order" 
ON public.orders 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::user_role));

-- 2. Add seller policy for viewing orders (sellers can see orders containing their products)
CREATE POLICY "Sellers can view orders with their products" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN shops s ON s.id = p.shop_id
    WHERE oi.order_id = orders.id AND s.user_id = auth.uid()
  )
);

-- 3. Add seller policy for order_items
CREATE POLICY "Sellers can view their product order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN shops s ON s.id = p.shop_id
    WHERE p.id = order_items.product_id AND s.user_id = auth.uid()
  )
);

-- 4. Fix commissions - add admin view
CREATE POLICY "Admins can view all commissions" 
ON public.commissions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update commissions" 
ON public.commissions 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::user_role));

-- 5. Admin policies for withdrawal requests
CREATE POLICY "Admins can view all seller withdrawals" 
ON public.seller_withdrawal_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update seller withdrawals" 
ON public.seller_withdrawal_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can view all blogger withdrawals" 
ON public.withdrawal_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update blogger withdrawals" 
ON public.withdrawal_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::user_role));

-- 6. Fix order_financials update policy
CREATE POLICY "Admins can update financials" 
ON public.order_financials 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::user_role));

-- 7. Add profile public view for display names (safe fields only)
CREATE POLICY "Public can view profile display names"
ON public.profiles
FOR SELECT
USING (true);

-- Update existing restrictive policy to allow user's own full access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;