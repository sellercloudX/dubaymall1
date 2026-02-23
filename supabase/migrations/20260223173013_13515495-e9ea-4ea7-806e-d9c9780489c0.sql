-- Fix notification insert policy: replace WITH CHECK (true) with secure SECURITY DEFINER function

-- Drop the permissive insert policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create restrictive policy: only admins can insert directly
CREATE POLICY "Only admins can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create SECURITY DEFINER function for edge functions / triggers to use
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_reference_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;