-- Blogger balances table
CREATE TABLE public.blogger_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  available_balance DECIMAL(12,2) DEFAULT 0,
  pending_balance DECIMAL(12,2) DEFAULT 0,
  total_earned DECIMAL(12,2) DEFAULT 0,
  total_withdrawn DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Affiliate links table
CREATE TABLE public.affiliate_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  blogger_id UUID NOT NULL,
  link_code VARCHAR(20) NOT NULL UNIQUE,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  total_commission DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Commissions table
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_link_id UUID REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  blogger_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  order_amount DECIMAL(12,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blogger_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_details JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.blogger_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Blogger balances policies
CREATE POLICY "Users can view own balance" ON public.blogger_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert balances" ON public.blogger_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update balances" ON public.blogger_balances
  FOR UPDATE USING (auth.uid() = user_id);

-- Affiliate links policies
CREATE POLICY "Anyone can view active affiliate links" ON public.affiliate_links
  FOR SELECT USING (is_active = true);

CREATE POLICY "Bloggers can create affiliate links" ON public.affiliate_links
  FOR INSERT WITH CHECK (auth.uid() = blogger_id AND public.has_role(auth.uid(), 'blogger'));

CREATE POLICY "Bloggers can update own links" ON public.affiliate_links
  FOR UPDATE USING (auth.uid() = blogger_id);

CREATE POLICY "Bloggers can delete own links" ON public.affiliate_links
  FOR DELETE USING (auth.uid() = blogger_id);

-- Commissions policies
CREATE POLICY "Bloggers can view own commissions" ON public.commissions
  FOR SELECT USING (auth.uid() = blogger_id);

CREATE POLICY "System can insert commissions" ON public.commissions
  FOR INSERT WITH CHECK (true);

-- Withdrawal requests policies
CREATE POLICY "Bloggers can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = blogger_id);

CREATE POLICY "Bloggers can create withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = blogger_id AND public.has_role(auth.uid(), 'blogger'));

-- Triggers for updated_at
CREATE TRIGGER update_blogger_balances_updated_at
  BEFORE UPDATE ON public.blogger_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_links_updated_at
  BEFORE UPDATE ON public.affiliate_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate affiliate link code
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(gen_random_uuid()::text), 1, 8));
END;
$$;

-- Function to track affiliate click
CREATE OR REPLACE FUNCTION public.track_affiliate_click(p_link_code VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.affiliate_links
  SET clicks = clicks + 1
  WHERE link_code = p_link_code;
END;
$$;