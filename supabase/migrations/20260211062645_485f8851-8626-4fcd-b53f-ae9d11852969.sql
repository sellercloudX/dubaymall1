
-- Drop and recreate reviews_public view with reviewer display info (no raw user_id)
DROP VIEW IF EXISTS public.reviews_public;

CREATE VIEW public.reviews_public
WITH (security_invoker = on) AS
SELECT 
  r.id, 
  r.product_id, 
  r.rating, 
  r.comment, 
  r.is_verified_purchase, 
  r.created_at, 
  r.updated_at,
  p.full_name AS reviewer_name,
  p.avatar_url AS reviewer_avatar
FROM public.reviews r
LEFT JOIN public.profiles p ON p.user_id = r.user_id;
