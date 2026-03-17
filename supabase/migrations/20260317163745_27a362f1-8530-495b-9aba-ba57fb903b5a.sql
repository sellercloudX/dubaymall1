
-- 1. balance_transactions: Remove user INSERT policy (all inserts go through deduct_balance/add_balance RPC)
DROP POLICY "Users can insert own transactions" ON public.balance_transactions;

-- 2. sellercloud_billing: Remove user INSERT policy (billing should only be created by admins/service)
DROP POLICY "Users can create own billing" ON public.sellercloud_billing;
-- Also clean up duplicate admin insert policy
DROP POLICY IF EXISTS "Only admins can insert billing" ON public.sellercloud_billing;

-- 3. sellercloud_payments: Remove user INSERT policy (payments created via click-payment edge function with service role)
DROP POLICY "Users can create own payments" ON public.sellercloud_payments;

-- 4. uzum_transactions: Replace user INSERT/UPDATE policies with admin-only
DROP POLICY "Service role can insert uzum transactions" ON public.uzum_transactions;
DROP POLICY "Service role can update uzum transactions" ON public.uzum_transactions;

CREATE POLICY "Only admins can insert uzum transactions"
  ON public.uzum_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Only admins can update uzum transactions"
  ON public.uzum_transactions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role));
