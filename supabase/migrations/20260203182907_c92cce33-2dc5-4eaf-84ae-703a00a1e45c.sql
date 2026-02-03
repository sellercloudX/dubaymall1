-- =============================================
-- SELLER BALANCES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.seller_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  pending_balance NUMERIC DEFAULT 0,
  available_balance NUMERIC DEFAULT 0,
  total_earned NUMERIC DEFAULT 0,
  total_withdrawn NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shop_id)
);

-- Enable RLS
ALTER TABLE public.seller_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Shop owners can view their balance" 
ON public.seller_balances FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM shops WHERE shops.id = seller_balances.shop_id AND shops.user_id = auth.uid()
));

CREATE POLICY "System can insert balances" 
ON public.seller_balances FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM shops WHERE shops.id = seller_balances.shop_id AND shops.user_id = auth.uid()
));

CREATE POLICY "System can update balances" 
ON public.seller_balances FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM shops WHERE shops.id = seller_balances.shop_id AND shops.user_id = auth.uid()
));

-- =============================================
-- SELLER WITHDRAWAL REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.seller_withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method VARCHAR NOT NULL,
  payment_details JSONB,
  status VARCHAR DEFAULT 'pending',
  notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seller_withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Shop owners can view own withdrawals" 
ON public.seller_withdrawal_requests FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM shops WHERE shops.id = seller_withdrawal_requests.shop_id AND shops.user_id = auth.uid()
));

CREATE POLICY "Shop owners can create withdrawals" 
ON public.seller_withdrawal_requests FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM shops WHERE shops.id = seller_withdrawal_requests.shop_id AND shops.user_id = auth.uid()
));

-- =============================================
-- ORDER FINANCIAL BREAKDOWN TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.order_financials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id),
  
  -- Amounts
  order_total NUMERIC NOT NULL,
  platform_commission_percent NUMERIC NOT NULL,
  platform_commission_amount NUMERIC NOT NULL,
  blogger_commission_percent NUMERIC DEFAULT 0,
  blogger_commission_amount NUMERIC DEFAULT 0,
  seller_net_amount NUMERIC NOT NULL,
  
  -- Dropshipping specific
  is_dropshipping BOOLEAN DEFAULT false,
  supplier_cost NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  seller_profit NUMERIC DEFAULT 0,
  
  -- Payout tracking
  payout_status VARCHAR DEFAULT 'pending', -- pending, ready, paid
  payout_available_at TIMESTAMP WITH TIME ZONE,
  payout_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Affiliate
  affiliate_link_id UUID REFERENCES public.affiliate_links(id),
  blogger_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS
ALTER TABLE public.order_financials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Shop owners can view their financials" 
ON public.order_financials FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM shops WHERE shops.id = order_financials.shop_id AND shops.user_id = auth.uid()
));

CREATE POLICY "System can insert financials" 
ON public.order_financials FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all financials" 
ON public.order_financials FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- FUNCTION: Calculate order financials
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_order_financials(
  p_order_id UUID,
  p_platform_commission_percent NUMERIC DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_shop_id UUID;
  v_is_dropshipping BOOLEAN;
  v_supplier_cost NUMERIC := 0;
  v_shipping_cost NUMERIC := 0;
  v_platform_commission NUMERIC;
  v_blogger_commission_percent NUMERIC := 0;
  v_blogger_commission_amount NUMERIC := 0;
  v_seller_net NUMERIC;
  v_seller_profit NUMERIC;
  v_payout_available_at TIMESTAMP;
  v_affiliate_link_id UUID;
  v_blogger_id UUID;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- Get first item's shop and product details
  SELECT 
    oi.product_id,
    p.shop_id,
    p.source,
    p.original_price,
    p.is_affiliate_enabled,
    p.affiliate_commission_percent
  INTO v_item
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id
  LIMIT 1;

  v_shop_id := v_item.shop_id;
  v_is_dropshipping := v_item.source = 'dropshipping';

  -- Calculate dropshipping costs
  IF v_is_dropshipping AND v_item.original_price IS NOT NULL THEN
    v_supplier_cost := v_item.original_price;
    v_shipping_cost := v_supplier_cost * 0.15; -- 15% estimated shipping
  END IF;

  -- Check for affiliate link
  SELECT al.id, al.blogger_id, p.affiliate_commission_percent
  INTO v_affiliate_link_id, v_blogger_id, v_blogger_commission_percent
  FROM affiliate_links al
  JOIN products p ON p.id = al.product_id
  WHERE al.product_id = v_item.product_id
    AND al.is_active = true
  LIMIT 1;

  -- Calculate commissions
  v_platform_commission := v_order.total_amount * (p_platform_commission_percent / 100);
  
  IF v_blogger_id IS NOT NULL AND v_blogger_commission_percent > 0 THEN
    v_blogger_commission_amount := v_order.total_amount * (v_blogger_commission_percent / 100);
  END IF;

  -- Calculate seller net
  v_seller_net := v_order.total_amount - v_platform_commission - v_blogger_commission_amount;
  
  -- For dropshipping, calculate actual profit
  IF v_is_dropshipping THEN
    v_seller_profit := v_seller_net - v_supplier_cost - v_shipping_cost;
  ELSE
    v_seller_profit := v_seller_net;
  END IF;

  -- Payout available after 7 days from delivery confirmation
  v_payout_available_at := COALESCE(v_order.delivery_confirmed_at, now()) + INTERVAL '7 days';

  -- Insert financial record
  INSERT INTO order_financials (
    order_id, shop_id, order_total,
    platform_commission_percent, platform_commission_amount,
    blogger_commission_percent, blogger_commission_amount,
    seller_net_amount, is_dropshipping,
    supplier_cost, shipping_cost, seller_profit,
    payout_available_at, affiliate_link_id, blogger_id
  ) VALUES (
    p_order_id, v_shop_id, v_order.total_amount,
    p_platform_commission_percent, v_platform_commission,
    v_blogger_commission_percent, v_blogger_commission_amount,
    v_seller_net, v_is_dropshipping,
    v_supplier_cost, v_shipping_cost, v_seller_profit,
    v_payout_available_at, v_affiliate_link_id, v_blogger_id
  )
  ON CONFLICT (order_id) DO UPDATE SET
    platform_commission_percent = EXCLUDED.platform_commission_percent,
    platform_commission_amount = EXCLUDED.platform_commission_amount,
    blogger_commission_percent = EXCLUDED.blogger_commission_percent,
    blogger_commission_amount = EXCLUDED.blogger_commission_amount,
    seller_net_amount = EXCLUDED.seller_net_amount,
    seller_profit = EXCLUDED.seller_profit;

  -- Record platform revenue
  INSERT INTO platform_revenue (source_type, source_id, amount, description)
  VALUES ('order_commission', p_order_id, v_platform_commission, 
    'Buyurtma ' || v_order.order_number || ' dan komissiya');

  -- Update blogger commission if affiliate sale
  IF v_blogger_id IS NOT NULL AND v_blogger_commission_amount > 0 THEN
    -- Add to blogger pending balance
    INSERT INTO blogger_balances (user_id, pending_balance)
    VALUES (v_blogger_id, v_blogger_commission_amount)
    ON CONFLICT (user_id) DO UPDATE SET
      pending_balance = blogger_balances.pending_balance + v_blogger_commission_amount,
      total_earned = blogger_balances.total_earned + v_blogger_commission_amount;

    -- Record commission
    INSERT INTO commissions (
      blogger_id, order_id, product_id, affiliate_link_id,
      order_amount, commission_percent, commission_amount, status
    ) VALUES (
      v_blogger_id, p_order_id, v_item.product_id, v_affiliate_link_id,
      v_order.total_amount, v_blogger_commission_percent, v_blogger_commission_amount, 'pending'
    );

    -- Update affiliate link stats
    UPDATE affiliate_links 
    SET conversions = conversions + 1, 
        total_commission = total_commission + v_blogger_commission_amount
    WHERE id = v_affiliate_link_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_total', v_order.total_amount,
    'platform_commission', v_platform_commission,
    'blogger_commission', v_blogger_commission_amount,
    'seller_net', v_seller_net,
    'seller_profit', v_seller_profit,
    'is_dropshipping', v_is_dropshipping
  );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.calculate_order_financials(UUID, NUMERIC) TO authenticated;

-- =============================================
-- FUNCTION: Process pending payouts
-- =============================================
CREATE OR REPLACE FUNCTION public.process_pending_payouts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_record RECORD;
BEGIN
  -- Process seller payouts (7 days after delivery)
  FOR v_record IN 
    SELECT of.id, of.shop_id, of.seller_profit
    FROM order_financials of
    JOIN orders o ON o.id = of.order_id
    WHERE of.payout_status = 'pending'
      AND o.delivery_confirmed_at IS NOT NULL
      AND of.payout_available_at <= now()
  LOOP
    -- Update financial record
    UPDATE order_financials SET payout_status = 'ready' WHERE id = v_record.id;
    
    -- Add to seller available balance
    INSERT INTO seller_balances (shop_id, available_balance, total_earned)
    VALUES (v_record.shop_id, v_record.seller_profit, v_record.seller_profit)
    ON CONFLICT (shop_id) DO UPDATE SET
      available_balance = seller_balances.available_balance + v_record.seller_profit,
      pending_balance = GREATEST(0, seller_balances.pending_balance - v_record.seller_profit);
    
    v_count := v_count + 1;
  END LOOP;

  -- Process blogger payouts (14 days after order)
  UPDATE commissions c
  SET status = 'available'
  FROM orders o
  WHERE c.order_id = o.id
    AND c.status = 'pending'
    AND o.delivery_confirmed_at IS NOT NULL
    AND o.delivery_confirmed_at + INTERVAL '14 days' <= now();

  -- Move blogger pending to available
  UPDATE blogger_balances bb
  SET 
    available_balance = available_balance + (
      SELECT COALESCE(SUM(commission_amount), 0) 
      FROM commissions 
      WHERE blogger_id = bb.user_id AND status = 'available'
    ),
    pending_balance = pending_balance - (
      SELECT COALESCE(SUM(commission_amount), 0) 
      FROM commissions 
      WHERE blogger_id = bb.user_id AND status = 'available'
    );

  RETURN v_count;
END;
$$;