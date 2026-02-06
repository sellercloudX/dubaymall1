
-- ============================================
-- FIX 1: Create has_admin_permission helper function
-- ============================================
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _permission text)
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
      AND (
        is_super_admin = true
        OR (
          CASE _permission
            WHEN 'can_manage_users' THEN can_manage_users
            WHEN 'can_manage_products' THEN can_manage_products
            WHEN 'can_manage_orders' THEN can_manage_orders
            WHEN 'can_manage_shops' THEN can_manage_shops
            WHEN 'can_manage_activations' THEN can_manage_activations
            WHEN 'can_manage_finances' THEN can_manage_finances
            WHEN 'can_manage_content' THEN can_manage_content
            WHEN 'can_add_admins' THEN can_add_admins
            ELSE false
          END
        ) = true
      )
  )
$$;

-- ============================================
-- FIX 2: Clean up duplicate profiles policies
-- ============================================

-- Remove duplicate INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Remove duplicate UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Remove duplicate SELECT policy
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;

-- Remove confusing "false" policy (public access is already blocked by RLS default-deny)
DROP POLICY IF EXISTS "Public profile access via view only" ON public.profiles;

-- ============================================
-- FIX 3: Restrict seller_profiles admin access
-- Split broad ALL policy into granular policies
-- ============================================

-- Drop the overly broad admin policy
DROP POLICY IF EXISTS "Admins can manage all seller profiles" ON public.seller_profiles;

-- Admins can VIEW seller profiles (needed for admin panel)
CREATE POLICY "Admins can view seller profiles"
ON public.seller_profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role)
);

-- Only super admins with finance permission can UPDATE seller profiles
CREATE POLICY "Finance admins can update seller profiles"
ON public.seller_profiles FOR UPDATE
USING (
  auth.uid() = user_id
  OR has_admin_permission(auth.uid(), 'can_manage_finances')
);

-- Only super admins with finance permission can INSERT seller profiles (for admin-created entries)
CREATE POLICY "Finance admins can insert seller profiles"
ON public.seller_profiles FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR has_admin_permission(auth.uid(), 'can_manage_finances')
);

-- Only super admins can DELETE seller profiles
CREATE POLICY "Super admins can delete seller profiles"
ON public.seller_profiles FOR DELETE
USING (
  is_super_admin(auth.uid())
);
