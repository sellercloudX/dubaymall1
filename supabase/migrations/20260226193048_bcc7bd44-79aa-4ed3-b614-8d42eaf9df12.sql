
-- Backfill emails from auth.users to profiles where missing
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.email = '');

-- Backfill phones from auth.users metadata where missing  
UPDATE public.profiles p
SET phone = u.raw_user_meta_data->>'phone'
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.phone IS NULL OR p.phone = '')
  AND u.raw_user_meta_data->>'phone' IS NOT NULL;
