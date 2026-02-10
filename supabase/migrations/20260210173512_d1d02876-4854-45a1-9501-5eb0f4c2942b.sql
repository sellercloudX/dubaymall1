
-- Auto-decrement stock when order items are inserted
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$;

-- Trigger on order_items insert
CREATE TRIGGER trg_decrement_stock_on_order
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_order();

-- Auto-create notification for seller when new order is placed
CREATE OR REPLACE FUNCTION public.notify_seller_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_shop_owner_id UUID;
  v_product_name TEXT;
BEGIN
  -- Get shop owner from first order item's product
  SELECT s.user_id, p.name INTO v_shop_owner_id, v_product_name
  FROM public.products p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE p.id = NEW.product_id
  LIMIT 1;
  
  IF v_shop_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_shop_owner_id,
      'Yangi buyurtma!',
      'Mahsulot: ' || COALESCE(v_product_name, 'Nomsiz') || ' (' || NEW.quantity || ' dona)',
      'order',
      NEW.order_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_seller_on_order
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_order();
