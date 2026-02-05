-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Super admins can manage admin permissions" ON public.admin_permissions;

-- Create a security definer function to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_permissions
    WHERE user_id = _user_id
      AND is_super_admin = true
  )
$$;

-- Create proper policies that don't cause recursion
-- Admins can view their own permissions
CREATE POLICY "Users can view own admin permissions"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Super admins can view all admin permissions (uses security definer function)
CREATE POLICY "Super admins can view all admin permissions"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Super admins can insert new admin permissions
CREATE POLICY "Super admins can insert admin permissions"
ON public.admin_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admins can update admin permissions
CREATE POLICY "Super admins can update admin permissions"
ON public.admin_permissions
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Super admins can delete admin permissions (except their own)
CREATE POLICY "Super admins can delete admin permissions"
ON public.admin_permissions
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()) AND user_id != auth.uid());