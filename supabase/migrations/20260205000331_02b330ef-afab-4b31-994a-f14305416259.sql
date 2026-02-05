-- Fix: Customer Phone Numbers and Personal Data exposure
-- Phone numbers should only be visible to the profile owner

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can view profile display names" ON public.profiles;

-- Create policy: Anyone can view basic profile info (for marketplace display)
-- But this policy alone doesn't restrict columns, so we need a view approach

-- Policy 1: Users can view their own full profile
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Public can view profiles but we'll use a view for column restriction
-- For now, deny direct public access - use view instead
CREATE POLICY "Public profile access via view only"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Create a public-safe view that excludes phone numbers
CREATE VIEW public.profiles_public
WITH (security_invoker = on)
AS SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;
-- Explicitly excludes: phone, preferred_language, updated_at

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.profiles_public IS 'Public-safe profile view excluding phone numbers and PII';