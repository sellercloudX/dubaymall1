-- Drop and recreate affiliate_links_public view without link_code
DROP VIEW IF EXISTS public.affiliate_links_public;

CREATE VIEW public.affiliate_links_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  product_id,
  is_active
FROM public.affiliate_links
WHERE is_active = true;