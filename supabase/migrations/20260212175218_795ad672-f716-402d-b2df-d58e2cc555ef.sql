
-- Logistics orders table for DubayMall integration
CREATE TABLE public.logistics_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  customer_telegram TEXT,
  
  -- Product/seller info
  product_name TEXT,
  seller_name TEXT,
  
  -- Delivery info
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('home', 'pickup')),
  payment_amount NUMERIC DEFAULT 0,
  target_point_id UUID,
  
  -- Tracking
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'accepted', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'cancelled')),
  confirmation_code TEXT NOT NULL,
  tracking_url TEXT,
  
  -- Courier/punkt info
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  courier_id UUID,
  courier_assigned_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_otp TEXT,
  delivery_otp_expires_at TIMESTAMPTZ,
  
  -- Linked DubayMall order (optional)
  dubaymall_order_id UUID,
  
  -- Notes/history
  notes TEXT,
  status_history JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logistics_orders ENABLE ROW LEVEL SECURITY;

-- Public read policy for tracking (anyone can track by barcode via edge function)
CREATE POLICY "Public can read logistics orders for tracking"
  ON public.logistics_orders FOR SELECT
  USING (true);

-- Admins can manage all
CREATE POLICY "Admins can manage logistics orders"
  ON public.logistics_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Sellers can view orders related to their shops
CREATE POLICY "Sellers can view their logistics orders"
  ON public.logistics_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'seller'));

-- Updated_at trigger
CREATE TRIGGER update_logistics_orders_updated_at
  BEFORE UPDATE ON public.logistics_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_orders;

-- Function to generate confirmation code
CREATE OR REPLACE FUNCTION public.generate_confirmation_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;

-- Function to update logistics order status with history
CREATE OR REPLACE FUNCTION public.update_logistics_status(
  p_barcode TEXT,
  p_new_status TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_history JSONB;
  v_otp TEXT;
BEGIN
  SELECT * INTO v_order FROM logistics_orders WHERE barcode = p_barcode;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Buyurtma topilmadi');
  END IF;
  
  -- Build history entry
  v_history := v_order.status_history || jsonb_build_array(jsonb_build_object(
    'from', v_order.status,
    'to', p_new_status,
    'at', now()::text,
    'actor', p_actor_id,
    'note', p_note
  ));
  
  -- Generate OTP for out_for_delivery
  IF p_new_status = 'out_for_delivery' THEN
    v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    UPDATE logistics_orders SET
      status = p_new_status,
      delivery_otp = v_otp,
      delivery_otp_expires_at = now() + INTERVAL '24 hours',
      status_history = v_history,
      courier_id = COALESCE(p_actor_id, courier_id),
      courier_assigned_at = COALESCE(courier_assigned_at, now())
    WHERE barcode = p_barcode;
    
    RETURN jsonb_build_object('success', true, 'otp', v_otp, 'status', p_new_status);
  END IF;
  
  -- Handle accepted
  IF p_new_status = 'accepted' THEN
    UPDATE logistics_orders SET
      status = p_new_status,
      accepted_at = now(),
      accepted_by = p_actor_id,
      status_history = v_history
    WHERE barcode = p_barcode;
    
    RETURN jsonb_build_object('success', true, 'status', p_new_status);
  END IF;
  
  -- Handle delivered
  IF p_new_status = 'delivered' THEN
    UPDATE logistics_orders SET
      status = p_new_status,
      delivered_at = now(),
      delivery_otp = NULL,
      status_history = v_history
    WHERE barcode = p_barcode;
    
    RETURN jsonb_build_object('success', true, 'status', p_new_status);
  END IF;
  
  -- Generic status update
  UPDATE logistics_orders SET
    status = p_new_status,
    status_history = v_history
  WHERE barcode = p_barcode;
  
  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

-- OTP verification for logistics
CREATE OR REPLACE FUNCTION public.verify_logistics_otp(p_barcode TEXT, p_otp TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM logistics_orders WHERE barcode = p_barcode;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Buyurtma topilmadi');
  END IF;
  
  IF v_order.delivery_otp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP kod yaratilmagan');
  END IF;
  
  IF v_order.delivery_otp_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP kod muddati tugagan');
  END IF;
  
  IF v_order.delivery_otp != p_otp THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP kod noto''g''ri');
  END IF;
  
  -- Mark as delivered
  PERFORM update_logistics_status(p_barcode, 'delivered', NULL, 'OTP bilan tasdiqlandi');
  
  RETURN jsonb_build_object('success', true, 'message', 'Yetkazib berish tasdiqlandi!');
END;
$$;
