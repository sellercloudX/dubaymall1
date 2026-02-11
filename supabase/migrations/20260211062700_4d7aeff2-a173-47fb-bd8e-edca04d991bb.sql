
-- Recreate reviews_public view using profiles_public (which is already security_invoker)
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
  pp.full_name AS reviewer_name,
  pp.avatar_url AS reviewer_avatar
FROM public.reviews r
LEFT JOIN public.profiles_public pp ON pp.user_id = r.user_id;
