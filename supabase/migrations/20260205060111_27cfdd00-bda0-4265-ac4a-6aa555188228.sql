-- =====================================================
-- ACTIVATION PROFILES FOR SELLER, BLOGGER, SELLERCLOUDX
-- =====================================================

-- Seller activation profile (YaTT/OOO, bank info)
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  
  -- Business info
  business_type TEXT NOT NULL DEFAULT 'yatt', -- 'yatt' or 'ooo'
  business_name TEXT,
  inn TEXT, -- Tax identification number
  oked TEXT, -- Activity code
  
  -- Bank info
  bank_name TEXT,
  bank_account TEXT,
  bank_mfo TEXT, -- Bank code
  
  -- Contact
  legal_address TEXT,
  contact_phone TEXT,
  
  -- Activation status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Blogger activation profile
CREATE TABLE IF NOT EXISTS public.blogger_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  -- Social media info
  social_platform TEXT NOT NULL, -- 'instagram', 'telegram', 'youtube', 'tiktok'
  social_username TEXT,
  social_url TEXT,
  followers_count INTEGER,
  
  -- Screenshots/proofs
  screenshots TEXT[], -- URLs to uploaded screenshots
  
  -- Additional info
  niche TEXT, -- 'fashion', 'tech', 'food', etc.
  description TEXT,
  
  -- Payment info for withdrawals
  payment_method TEXT,
  payment_details JSONB,
  
  -- Activation status
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update sellercloud_subscriptions for new flow
ALTER TABLE public.sellercloud_subscriptions 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS marketplace_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS initial_payment_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS initial_payment_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogger_profiles ENABLE ROW LEVEL SECURITY;

-- Seller profiles policies
CREATE POLICY "Users can view own seller profile"
ON public.seller_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own seller profile"
ON public.seller_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own seller profile"
ON public.seller_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all seller profiles"
ON public.seller_profiles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Blogger profiles policies
CREATE POLICY "Users can view own blogger profile"
ON public.blogger_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blogger profile"
ON public.blogger_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blogger profile"
ON public.blogger_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all blogger profiles"
ON public.blogger_profiles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Function to check if user can have multiple roles
CREATE OR REPLACE FUNCTION public.can_add_role(p_user_id UUID, p_new_role user_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_admin_approved BOOLEAN;
  v_existing_roles INTEGER;
BEGIN
  -- Check if user is admin
  v_is_admin := public.has_role(p_user_id, 'admin');
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Check existing roles count (excluding buyer which everyone has implicitly)
  SELECT COUNT(*) INTO v_existing_roles
  FROM public.user_roles
  WHERE user_id = p_user_id AND role != 'admin';
  
  -- If no roles yet, allow adding one
  IF v_existing_roles = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Otherwise, only admin can add more roles (handled by RLS)
  RETURN FALSE;
END;
$$;

-- Update user_roles insert policy to enforce single role
DROP POLICY IF EXISTS "Users can add roles to themselves" ON public.user_roles;
CREATE POLICY "Users can add single role to themselves"
ON public.user_roles FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND public.can_add_role(auth.uid(), role)
);

-- Admins can add any role
CREATE POLICY "Admins can add any role"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));