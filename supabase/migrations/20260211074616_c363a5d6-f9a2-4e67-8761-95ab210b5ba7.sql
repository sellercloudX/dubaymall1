-- Fix reviews_public view to use SECURITY INVOKER instead of default SECURITY DEFINER
DROP VIEW IF EXISTS public.reviews_public;

CREATE VIEW public.reviews_public
WITH (security_invoker=true) AS
  SELECT r.id,
    r.product_id,
    r.rating,
    r.comment,
    r.is_verified_purchase,
    r.created_at,
    r.updated_at,
    p.full_name AS reviewer_name,
    p.avatar_url AS reviewer_avatar
  FROM reviews r
  LEFT JOIN profiles p ON p.user_id = r.user_id;