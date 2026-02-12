-- Remove the overly permissive public SELECT policy on shops
DROP POLICY IF EXISTS "Shops are viewable by everyone" ON public.shops;

-- Add owner-only SELECT policy
CREATE POLICY "Shop owners can view their own shops"
ON public.shops
FOR SELECT
USING (auth.uid() = user_id);

-- Add admin SELECT policy
CREATE POLICY "Admins can view all shops"
ON public.shops
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add seller SELECT policy (sellers need to see shops for order context)
CREATE POLICY "Sellers can view shops for orders"
ON public.shops
FOR SELECT
USING (has_role(auth.uid(), 'seller'::user_role));