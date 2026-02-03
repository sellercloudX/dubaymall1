-- Add OTP delivery confirmation columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6),
ADD COLUMN IF NOT EXISTS delivery_otp_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_confirmed_by VARCHAR(20);

-- Create function to generate delivery OTP
CREATE OR REPLACE FUNCTION public.generate_delivery_otp(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp TEXT;
  v_order_user_id UUID;
BEGIN
  -- Generate 6-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Update order with OTP (expires in 24 hours)
  UPDATE orders
  SET 
    delivery_otp = v_otp,
    delivery_otp_expires_at = NOW() + INTERVAL '24 hours',
    status = 'out_for_delivery'
  WHERE id = p_order_id
  RETURNING user_id INTO v_order_user_id;
  
  RETURN v_otp;
END;
$$;

-- Create function to verify delivery OTP
CREATE OR REPLACE FUNCTION public.verify_delivery_otp(p_order_id UUID, p_otp VARCHAR(6))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_result JSONB;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Buyurtma topilmadi');
  END IF;
  
  -- Check if already confirmed
  IF v_order.delivery_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Buyurtma allaqachon tasdiqlangan');
  END IF;
  
  -- Check if OTP exists
  IF v_order.delivery_otp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP kod yaratilmagan');
  END IF;
  
  -- Check if OTP expired
  IF v_order.delivery_otp_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP kod muddati tugagan');
  END IF;
  
  -- Verify OTP
  IF v_order.delivery_otp != p_otp THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP kod noto''g''ri');
  END IF;
  
  -- Update order as delivered and confirmed
  UPDATE orders
  SET 
    status = 'delivered',
    delivery_confirmed_at = NOW(),
    delivery_confirmed_by = 'otp',
    delivery_otp = NULL -- Clear OTP after use
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Yetkazib berish tasdiqlandi!');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_delivery_otp(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery_otp(UUID, VARCHAR) TO authenticated;