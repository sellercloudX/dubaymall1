-- =====================================================
-- STRENGTHEN PROFILES TABLE SECURITY
-- =====================================================

-- Drop any overly permissive policies on profiles
DROP POLICY IF EXISTS "Public can view profile display names" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Ensure only profile owner can view their full profile (including phone)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- UPDATE PROFILES_PUBLIC VIEW (ensure no sensitive data)
-- =====================================================

-- Recreate the public view WITHOUT phone and with security_invoker
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  created_at
  -- Explicitly excluding: phone, preferred_language
FROM public.profiles;

-- =====================================================
-- STRENGTHEN USER_ADDRESSES TABLE SECURITY
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies and recreate strict ones
DROP POLICY IF EXISTS "Users can view own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can manage own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Anyone can view addresses" ON public.user_addresses;

-- Only address owner can view their addresses
CREATE POLICY "Users can view own addresses"
ON public.user_addresses FOR SELECT
USING (auth.uid() = user_id);

-- Only address owner can insert their addresses
CREATE POLICY "Users can insert own addresses"
ON public.user_addresses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only address owner can update their addresses
CREATE POLICY "Users can update own addresses"
ON public.user_addresses FOR UPDATE
USING (auth.uid() = user_id);

-- Only address owner can delete their addresses
CREATE POLICY "Users can delete own addresses"
ON public.user_addresses FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view addresses (for order fulfillment)
CREATE POLICY "Admins can view all addresses"
ON public.user_addresses FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));