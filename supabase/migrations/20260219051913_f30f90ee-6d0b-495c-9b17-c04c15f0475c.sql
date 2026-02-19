-- Allow super admins and users with can_manage_users to view ALL marketplace connections
CREATE POLICY "Admins can view all connections"
ON public.marketplace_connections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND (admin_permissions.is_super_admin = true OR admin_permissions.can_manage_users = true)
  )
);