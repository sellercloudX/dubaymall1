-- Create trigger to automatically make specific email a super admin
CREATE OR REPLACE FUNCTION public.make_super_admin_on_register()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the designated super admin email
  IF NEW.email = 'rasmiydorixona@gmail.com' THEN
    -- Add admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Add super admin permissions
    INSERT INTO public.admin_permissions (
      user_id, 
      is_super_admin,
      can_manage_users,
      can_manage_products,
      can_manage_orders,
      can_manage_shops,
      can_manage_activations,
      can_manage_finances,
      can_manage_content,
      can_add_admins
    ) VALUES (
      NEW.id,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true
    )
    ON CONFLICT (user_id) DO UPDATE SET
      is_super_admin = true,
      can_manage_users = true,
      can_manage_products = true,
      can_manage_orders = true,
      can_manage_shops = true,
      can_manage_activations = true,
      can_manage_finances = true,
      can_manage_content = true,
      can_add_admins = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_super_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.make_super_admin_on_register();