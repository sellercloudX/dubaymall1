-- Recreate profiles_public view with security_invoker to enforce underlying RLS
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, user_id, full_name, avatar_url, created_at
FROM public.profiles;