
-- Fix: Add authorization checks to calculate_order_financials function
-- Prevents any authenticated user from manipulating commission calculations for arbitrary orders

CREATE OR REPLACE FUNCTION public.calculate_order_financials(p_order_id uuid, p_platform_commission_percent numeric DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_shop_id UUID;
  v_shop_user_id UUID;
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
  v_category_commission NUMERIC := 0;
  v_total_commission_percent NUMERIC;
  v_actual_commission_percent NUMERIC;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- ========== AUTHORIZATION CHECK ==========
  -- Get shop owner for this order
  SELECT DISTINCT s.user_id, s.id INTO v_shop_user_id, v_shop_id
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN shops s ON s.id = p.shop_id
  WHERE oi.order_id = p_order_id
  LIMIT 1;

  -- Verify caller is order owner, shop owner, or admin
  IF auth.uid() IS NULL 
     OR (auth.uid() != v_order.user_id 
         AND auth.uid() != v_shop_user_id
         AND NOT has_role(auth.uid(), 'admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'message', 'Access denied');
  END IF;

  -- Only admins can override the commission percent parameter
  -- Non-admins always use default (5%) to prevent commission manipulation
  IF NOT has_role(auth.uid(), 'admin') THEN
    v_actual_commission_percent := 5;
  ELSE
    v_actual_commission_percent := p_platform_commission_percent;
  END IF;
  -- ========== END AUTHORIZATION CHECK ==========

  -- Don't process cancelled or returned orders
  IF v_order.status IN ('cancelled', 'returned', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order is cancelled/returned');
  END IF;

  -- Get first item's shop and product details
  SELECT 
    oi.product_id,
    p.shop_id,
    p.source,
    p.original_price,
    p.is_affiliate_enabled,
    p.affiliate_commission_percent,
    p.category_id
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
    v_shipping_cost := v_supplier_cost * 0.15;
  END IF;

  -- Get category commission if exists
  SELECT COALESCE(commission_percent, 0) INTO v_category_commission
  FROM category_commissions
  WHERE category_id = v_item.category_id AND is_active = true;

  -- Total commission = base + category
  v_total_commission_percent := v_actual_commission_percent + COALESCE(v_category_commission, 0);

  -- Check for affiliate link
  SELECT al.id, al.blogger_id, p.affiliate_commission_percent
  INTO v_affiliate_link_id, v_blogger_id, v_blogger_commission_percent
  FROM affiliate_links al
  JOIN products p ON p.id = al.product_id
  WHERE al.product_id = v_item.product_id
    AND al.is_active = true
  LIMIT 1;

  -- Calculate commissions
  v_platform_commission := v_order.total_amount * (v_total_commission_percent / 100);
  
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

  -- Payout available after 10 days from delivery confirmation
  v_payout_available_at := COALESCE(v_order.delivery_confirmed_at, now()) + INTERVAL '10 days';

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
    v_total_commission_percent, v_platform_commission,
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
    INSERT INTO blogger_balances (user_id, pending_balance)
    VALUES (v_blogger_id, v_blogger_commission_amount)
    ON CONFLICT (user_id) DO UPDATE SET
      pending_balance = blogger_balances.pending_balance + v_blogger_commission_amount,
      total_earned = blogger_balances.total_earned + v_blogger_commission_amount;

    INSERT INTO commissions (
      blogger_id, order_id, product_id, affiliate_link_id,
      order_amount, commission_percent, commission_amount, status
    ) VALUES (
      v_blogger_id, p_order_id, v_item.product_id, v_affiliate_link_id,
      v_order.total_amount, v_blogger_commission_percent, v_blogger_commission_amount, 'pending'
    );

    UPDATE affiliate_links 
    SET conversions = conversions + 1, 
        total_commission = total_commission + v_blogger_commission_amount
    WHERE id = v_affiliate_link_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_total', v_order.total_amount,
    'platform_commission', v_platform_commission,
    'platform_commission_percent', v_total_commission_percent,
    'blogger_commission', v_blogger_commission_amount,
    'seller_net', v_seller_net,
    'seller_profit', v_seller_profit,
    'is_dropshipping', v_is_dropshipping
  );
END;
$function$;
