-- Fix infinite recursion in orders/order_items RLS policies
-- The problem: orders policy checks order_items, and order_items policy checks orders

-- Step 1: Create SECURITY DEFINER functions to break the recursion

-- Function to check if a user owns an order (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_owns_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = _order_id AND user_id = _user_id
  )
$$;

-- Function to check if a seller has products in an order (bypasses RLS)
CREATE OR REPLACE FUNCTION public.seller_has_order_products(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.shops s ON s.id = p.shop_id
    WHERE oi.order_id = _order_id AND s.user_id = _user_id
  )
$$;

-- Step 2: Drop the problematic policies
DROP POLICY IF EXISTS "Sellers can view orders with their products" ON public.orders;
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Sellers can view their product order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;

-- Step 3: Recreate policies using SECURITY DEFINER functions

-- Orders: Sellers can view orders containing their products
CREATE POLICY "Sellers can view orders with their products"
ON public.orders
FOR SELECT
USING (
  public.seller_has_order_products(auth.uid(), id)
);

-- Order items: Users can view their own order items
CREATE POLICY "Users can view their order items"
ON public.order_items
FOR SELECT
USING (
  public.user_owns_order(auth.uid(), order_id)
);

-- Order items: Sellers can view items for orders containing their products
CREATE POLICY "Sellers can view their product order items"
ON public.order_items
FOR SELECT
USING (
  public.seller_has_order_products(auth.uid(), order_id)
);

-- Order items: Users can create items for their own orders
CREATE POLICY "Users can create order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  public.user_owns_order(auth.uid(), order_id)
);

-- Also add admin policy for order_items
CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
);