-- Allow admins (super_admin or can_manage_users) to read all users' cost prices
CREATE POLICY "Admins can view all cost prices"
ON public.marketplace_cost_prices
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_admin_permission(auth.uid(), 'can_manage_users')
);

-- Drop the old restrictive policy since new one covers both cases
DROP POLICY IF EXISTS "Users can view own cost prices" ON public.marketplace_cost_prices;
