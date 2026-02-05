-- Fix SECURITY DEFINER views - recreate with SECURITY INVOKER

-- Drop and recreate shops_public view with SECURITY INVOKER
DROP VIEW IF EXISTS public.shops_public;
CREATE VIEW public.shops_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  slug,
  description,
  logo_url,
  banner_url,
  rating,
  total_sales,
  is_active,
  created_at,
  updated_at
FROM shops
WHERE is_active = true;

-- Grant access
GRANT SELECT ON public.shops_public TO anon, authenticated;

-- Drop and recreate affiliate_links_public view with SECURITY INVOKER
DROP VIEW IF EXISTS public.affiliate_links_public;
CREATE VIEW public.affiliate_links_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  product_id,
  link_code,
  is_active
FROM affiliate_links
WHERE is_active = true;

-- Grant access
GRANT SELECT ON public.affiliate_links_public TO anon, authenticated;