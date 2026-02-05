-- Create admin permissions table for limited admin access
CREATE TABLE public.admin_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    can_manage_users BOOLEAN DEFAULT false,
    can_manage_products BOOLEAN DEFAULT false,
    can_manage_orders BOOLEAN DEFAULT false,
    can_manage_shops BOOLEAN DEFAULT false,
    can_manage_activations BOOLEAN DEFAULT false,
    can_manage_finances BOOLEAN DEFAULT false,
    can_manage_content BOOLEAN DEFAULT false,
    can_add_admins BOOLEAN DEFAULT false,
    is_super_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin permissions
CREATE POLICY "Admins can view admin permissions"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only super admins can manage admin permissions
CREATE POLICY "Super admins can manage admin permissions"
ON public.admin_permissions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_permissions ap
        WHERE ap.user_id = auth.uid() AND ap.is_super_admin = true
    )
);

-- Create index for faster lookups
CREATE INDEX idx_admin_permissions_user_id ON public.admin_permissions(user_id);

-- Update trigger for updated_at
CREATE TRIGGER update_admin_permissions_updated_at
BEFORE UPDATE ON public.admin_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grant first admin super_admin status (the existing admin)
INSERT INTO public.admin_permissions (user_id, is_super_admin, can_manage_users, can_manage_products, can_manage_orders, can_manage_shops, can_manage_activations, can_manage_finances, can_manage_content, can_add_admins)
SELECT ur.user_id, true, true, true, true, true, true, true, true, true
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;