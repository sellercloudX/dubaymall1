
-- Function to notify admins on Telegram when new user registers
CREATE OR REPLACE FUNCTION public.notify_admin_new_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin RECORD;
  v_bot_token TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  v_full_name := COALESCE(NEW.full_name, 'Nomsiz');
  v_phone := COALESCE(NEW.phone, 'N/A');
  v_email := COALESCE(NEW.email, 'N/A');

  -- We'll use pg_net or http extension if available, otherwise skip
  -- For now, insert a notification record that edge function can pick up
  INSERT INTO public.notifications (
    user_id, title, message, type
  )
  SELECT ap.user_id, 
    'Yangi ro''yxatdan o''tish',
    '👤 ' || v_full_name || E'\n📱 ' || v_phone || E'\n📧 ' || v_email,
    'system'
  FROM public.admin_permissions ap
  WHERE ap.is_super_admin = true OR ap.can_manage_users = true;

  RETURN NEW;
END;
$$;

-- Trigger on profiles insert
CREATE TRIGGER on_new_profile_notify_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_registration();
