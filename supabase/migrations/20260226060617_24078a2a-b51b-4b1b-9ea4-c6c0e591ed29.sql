
-- Backfill email from auth.users for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
AND (p.email IS NULL OR p.email = '');

-- Backfill phone from auth.users raw_user_meta_data for existing profiles
UPDATE public.profiles p
SET phone = u.raw_user_meta_data->>'phone'
FROM auth.users u
WHERE p.user_id = u.id
AND (p.phone IS NULL OR p.phone = '')
AND u.raw_user_meta_data->>'phone' IS NOT NULL
AND u.raw_user_meta_data->>'phone' != '';
