-- Add INSERT policy for admins to create subscriptions for any user
CREATE POLICY "Admins can create subscriptions"
ON public.sellercloud_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::user_role));