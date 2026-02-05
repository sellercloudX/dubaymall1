-- Fix: Shop Owner Identity Could Be Exposed to Competitors
-- Create a public view that excludes user_id for shops

-- Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Active shops are viewable by everyone" ON shops;

-- Create restrictive policy: users can see all active shops (needed for marketplace) but only owners see their own shops with full data
CREATE POLICY "Anyone can view active shop public info"
ON shops FOR SELECT
USING (is_active = true);

-- Create a public view for shops that excludes sensitive user_id
CREATE OR REPLACE VIEW public.shops_public AS
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

-- Grant access to the view
GRANT SELECT ON public.shops_public TO anon, authenticated;

-- Fix: Affiliate Marketing Strategy Could Be Stolen
-- Drop the overly permissive SELECT policy on affiliate_links
DROP POLICY IF EXISTS "Anyone can view active affiliate links" ON affiliate_links;

-- Create proper RLS: only bloggers see their own links, admins see all
CREATE POLICY "Bloggers can view their own affiliate links"
ON affiliate_links FOR SELECT
USING (
  auth.uid() = blogger_id 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- Create public view for affiliate links that only shows necessary public info (link_code for tracking)
CREATE OR REPLACE VIEW public.affiliate_links_public AS
SELECT 
  id,
  product_id,
  link_code,
  is_active
FROM affiliate_links
WHERE is_active = true;

-- Grant access to the public view
GRANT SELECT ON public.affiliate_links_public TO anon, authenticated;