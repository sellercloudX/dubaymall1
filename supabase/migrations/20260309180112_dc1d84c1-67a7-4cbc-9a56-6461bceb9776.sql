
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view platform settings" ON public.platform_settings;

-- Allow authenticated users to read only specific safe setting keys
CREATE POLICY "Authenticated users can view safe platform settings"
ON public.platform_settings FOR SELECT TO authenticated
USING (
  setting_key IN ('sales_commission', 'subscription_plans', 'promo_period')
  OR public.has_role(auth.uid(), 'admin'::user_role)
);
