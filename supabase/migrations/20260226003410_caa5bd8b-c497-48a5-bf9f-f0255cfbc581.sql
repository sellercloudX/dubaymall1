-- Fix 1: Remove hardcoded super admin email trigger (admin already created, use manage_admin() RPC going forward)
DROP TRIGGER IF EXISTS on_auth_user_created_super_admin ON auth.users;
DROP FUNCTION IF EXISTS public.make_super_admin_on_register();