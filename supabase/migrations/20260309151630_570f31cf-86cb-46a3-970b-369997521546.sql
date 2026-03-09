DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;

CREATE POLICY "Authenticated users can view platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);