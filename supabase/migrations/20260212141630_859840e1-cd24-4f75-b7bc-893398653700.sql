
-- Add activation admin update policy for seller_profiles
CREATE POLICY "Activation admins can update seller profiles"
ON public.seller_profiles
FOR UPDATE
USING (has_admin_permission(auth.uid(), 'can_manage_activations'));

-- Add activation admin update policy for blogger_profiles (currently only has_role check)
CREATE POLICY "Activation admins can update blogger profiles"
ON public.blogger_profiles
FOR UPDATE
USING (has_admin_permission(auth.uid(), 'can_manage_activations'));

-- Add admin SELECT policy for seller_profiles using admin_permissions (more granular)
CREATE POLICY "Activation admins can view seller profiles"
ON public.seller_profiles
FOR SELECT
USING (has_admin_permission(auth.uid(), 'can_manage_activations'));

-- Add activation admin SELECT for blogger_profiles
CREATE POLICY "Activation admins can view blogger profiles"
ON public.blogger_profiles
FOR SELECT
USING (has_admin_permission(auth.uid(), 'can_manage_activations'));
