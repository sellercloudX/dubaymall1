
-- Referral (taklif) tizimi
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code VARCHAR(12) NOT NULL UNIQUE,
  total_invites INTEGER DEFAULT 0,
  total_bonus_uzs NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code VARCHAR(12) NOT NULL,
  referrer_bonus_uzs NUMERIC DEFAULT 20000,
  referred_bonus_uzs NUMERIC DEFAULT 10000,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id)
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own referral code" ON public.referral_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own referral code" ON public.referral_codes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own rewards" ON public.referral_rewards
  FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "Admins can view all referrals" ON public.referral_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all rewards" ON public.referral_rewards
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT code INTO v_code FROM referral_codes WHERE user_id = p_user_id LIMIT 1;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  
  v_code := 'SCX-' || UPPER(SUBSTRING(MD5(p_user_id::text || now()::text), 1, 6));
  INSERT INTO referral_codes (user_id, code) VALUES (p_user_id, v_code)
  ON CONFLICT (user_id) DO NOTHING;
  
  SELECT code INTO v_code FROM referral_codes WHERE user_id = p_user_id;
  RETURN v_code;
END;
$$;

-- Function to apply referral bonus
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(p_referred_id UUID, p_referral_code VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_referrer_id UUID;
  v_already BOOLEAN;
  v_referrer_bonus NUMERIC := 20000;
  v_referred_bonus NUMERIC := 10000;
BEGIN
  -- Check if already referred
  SELECT EXISTS(SELECT 1 FROM referral_rewards WHERE referred_id = p_referred_id) INTO v_already;
  IF v_already THEN RETURN jsonb_build_object('success', false, 'error', 'already_referred'); END IF;
  
  -- Find referrer
  SELECT user_id INTO v_referrer_id FROM referral_codes WHERE code = p_referral_code AND is_active = true;
  IF v_referrer_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_code'); END IF;
  IF v_referrer_id = p_referred_id THEN RETURN jsonb_build_object('success', false, 'error', 'self_referral'); END IF;
  
  -- Record reward
  INSERT INTO referral_rewards (referrer_id, referred_id, referral_code, referrer_bonus_uzs, referred_bonus_uzs, status)
  VALUES (v_referrer_id, p_referred_id, p_referral_code, v_referrer_bonus, v_referred_bonus, 'pending');
  
  -- Update referral stats
  UPDATE referral_codes SET total_invites = total_invites + 1, updated_at = now() WHERE user_id = v_referrer_id;
  
  -- Add bonus to referred user balance
  PERFORM add_balance(p_referred_id, v_referred_bonus, 'referral_bonus', 'Taklif bonusi: ' || v_referred_bonus || ' UZS');
  
  -- Add bonus to referrer balance  
  PERFORM add_balance(v_referrer_id, v_referrer_bonus, 'referral_bonus', 'Do''st taklif bonusi: ' || v_referrer_bonus || ' UZS');
  UPDATE referral_codes SET total_bonus_uzs = total_bonus_uzs + v_referrer_bonus WHERE user_id = v_referrer_id;
  UPDATE referral_rewards SET status = 'paid', paid_at = now() WHERE referred_id = p_referred_id;
  
  RETURN jsonb_build_object('success', true, 'referrer_bonus', v_referrer_bonus, 'referred_bonus', v_referred_bonus);
END;
$$;

-- Add unique constraint on user_id for referral_codes
ALTER TABLE public.referral_codes ADD CONSTRAINT referral_codes_user_id_unique UNIQUE (user_id);
