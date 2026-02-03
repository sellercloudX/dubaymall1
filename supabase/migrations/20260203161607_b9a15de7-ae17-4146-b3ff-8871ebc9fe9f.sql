-- Fix the permissive policy on commissions table
DROP POLICY IF EXISTS "System can insert commissions" ON public.commissions;

-- Create more restrictive policy - only authenticated users can trigger commission creation
CREATE POLICY "Authenticated can insert commissions" ON public.commissions
  FOR INSERT TO authenticated WITH CHECK (true);