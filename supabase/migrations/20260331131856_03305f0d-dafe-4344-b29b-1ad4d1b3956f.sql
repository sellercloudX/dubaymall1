
-- 1. Fix profiles: use user_id instead of id for ownership check
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. Enable RLS on logistics_orders_safe view (it was created with security_invoker but needs explicit enable)
ALTER VIEW public.logistics_orders_safe SET (security_invoker = true);

-- 3. Add ai_usage_log SELECT policy for users
CREATE POLICY "Users can view own ai usage"
ON public.ai_usage_log FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 4. Acknowledge user_roles (warn level - already safe, can_add_role restricts to 'buyer')
-- No action needed

-- 5. Acknowledge team_activity_log (warn level - server-side logging via service role)
-- No action needed
