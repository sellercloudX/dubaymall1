-- Create dropshipping_orders table for tracking supplier orders
CREATE TABLE public.dropshipping_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  shop_id UUID NOT NULL REFERENCES public.shops(id),
  
  -- Supplier info
  supplier_platform TEXT NOT NULL DEFAULT 'cjdropshipping', -- cjdropshipping, aliexpress, 1688
  supplier_order_id TEXT, -- Order ID from supplier
  supplier_order_status TEXT DEFAULT 'pending', -- pending, ordered, shipped, delivered, cancelled
  
  -- Costs
  supplier_cost NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  
  -- Shipping
  shipping_method TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  estimated_delivery_days TEXT,
  
  -- Variant/SKU info
  variant_id TEXT,
  variant_sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Customer shipping address (copied from order)
  shipping_address JSONB,
  
  -- Status timestamps
  ordered_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Metadata
  supplier_response JSONB, -- Raw response from supplier API
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dropshipping_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Sellers can view their shop's dropshipping orders
CREATE POLICY "Sellers can view their dropshipping orders"
ON public.dropshipping_orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shops 
    WHERE shops.id = dropshipping_orders.shop_id 
    AND shops.user_id = auth.uid()
  )
);

-- Sellers can insert dropshipping orders for their shop
CREATE POLICY "Sellers can create dropshipping orders"
ON public.dropshipping_orders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops 
    WHERE shops.id = dropshipping_orders.shop_id 
    AND shops.user_id = auth.uid()
  )
);

-- Sellers can update their dropshipping orders
CREATE POLICY "Sellers can update their dropshipping orders"
ON public.dropshipping_orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.shops 
    WHERE shops.id = dropshipping_orders.shop_id 
    AND shops.user_id = auth.uid()
  )
);

-- Add indexes
CREATE INDEX idx_dropshipping_orders_order_id ON public.dropshipping_orders(order_id);
CREATE INDEX idx_dropshipping_orders_shop_id ON public.dropshipping_orders(shop_id);
CREATE INDEX idx_dropshipping_orders_status ON public.dropshipping_orders(supplier_order_status);
CREATE INDEX idx_dropshipping_orders_tracking ON public.dropshipping_orders(tracking_number);

-- Add trigger for updated_at
CREATE TRIGGER update_dropshipping_orders_updated_at
BEFORE UPDATE ON public.dropshipping_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();