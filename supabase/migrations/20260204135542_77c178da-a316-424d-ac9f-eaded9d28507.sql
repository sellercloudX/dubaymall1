-- Fix RLS policies - remove overly permissive ones and add proper checks

-- Drop the permissive billing insert policy
DROP POLICY IF EXISTS "System can insert billing" ON public.sellercloud_billing;

-- Add proper billing insert policy (only admins or subscription owner)
CREATE POLICY "Users can create own billing" ON public.sellercloud_billing
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update billing ALL policy to be more specific
DROP POLICY IF EXISTS "Admins can manage billing" ON public.sellercloud_billing;
CREATE POLICY "Admins can update billing" ON public.sellercloud_billing
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can insert billing" ON public.sellercloud_billing
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can delete billing" ON public.sellercloud_billing
  FOR DELETE USING (has_role(auth.uid(), 'admin'::user_role));

-- Update payments admin policy
DROP POLICY IF EXISTS "Admins can manage payments" ON public.sellercloud_payments;
CREATE POLICY "Admins can view payments" ON public.sellercloud_payments
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can update payments" ON public.sellercloud_payments
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can insert payments" ON public.sellercloud_payments
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::user_role));