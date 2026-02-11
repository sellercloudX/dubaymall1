
-- Drop the security_invoker view and recreate without it so the view owner can read profiles
DROP VIEW IF EXISTS public.reviews_public;

CREATE VIEW public.reviews_public AS
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

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.reviews_public TO anon, authenticated;
