
-- Fix 1: Ensure billing INSERT is admin-only (drop old permissive + existing strict, recreate)
DROP POLICY IF EXISTS "System can insert billing" ON public.sellercloud_billing;
DROP POLICY IF EXISTS "Only admins can insert billing" ON public.sellercloud_billing;

CREATE POLICY "Only admins can insert billing"
ON public.sellercloud_billing FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Storage path-ownership (already applied above, just ensure consistency)
-- These were already applied in the previous migration attempt
