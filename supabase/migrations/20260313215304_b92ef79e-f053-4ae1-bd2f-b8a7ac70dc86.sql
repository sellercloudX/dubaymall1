
-- 1. uzum_accounts: Store API keys and Manager Role session status
CREATE TABLE public.uzum_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT,
  shop_id TEXT,
  api_key TEXT,
  encrypted_api_key TEXT,
  manager_phone TEXT,
  manager_status TEXT DEFAULT 'not_invited' CHECK (manager_status IN ('not_invited', 'invited', 'pending', 'active', 'revoked')),
  manager_invited_at TIMESTAMPTZ,
  manager_connected_at TIMESTAMPTZ,
  session_token TEXT,
  session_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  account_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. uzum_products: SKU, Category, Warehouse Stock, Price, Boost Status
CREATE TABLE public.uzum_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uzum_account_id UUID NOT NULL REFERENCES public.uzum_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uzum_product_id TEXT,
  sku TEXT,
  title TEXT NOT NULL,
  title_ru TEXT,
  description TEXT,
  description_ru TEXT,
  category_id TEXT,
  category_name TEXT,
  price NUMERIC DEFAULT 0,
  original_price NUMERIC,
  cost_price NUMERIC DEFAULT 0,
  stock_fbo INTEGER DEFAULT 0,
  stock_fbs INTEGER DEFAULT 0,
  stock_total INTEGER GENERATED ALWAYS AS (stock_fbo + stock_fbs) STORED,
  images TEXT[] DEFAULT '{}',
  barcode TEXT,
  brand_name TEXT,
  mxik_code TEXT,
  commission_percent NUMERIC,
  boost_active BOOLEAN DEFAULT false,
  boost_budget NUMERIC DEFAULT 0,
  boost_started_at TIMESTAMPTZ,
  boost_ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'moderation', 'rejected', 'archived')),
  characteristics JSONB DEFAULT '[]',
  weight_kg NUMERIC,
  dimensions JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. uzum_orders: FBO and FBS orders with delivery status and Lost Items flag
CREATE TABLE public.uzum_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uzum_account_id UUID NOT NULL REFERENCES public.uzum_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_code TEXT NOT NULL,
  order_number TEXT,
  fulfillment_type TEXT DEFAULT 'FBO' CHECK (fulfillment_type IN ('FBO', 'FBS')),
  status TEXT DEFAULT 'created',
  substatus TEXT,
  created_at_uzum TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  total_amount NUMERIC DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  items JSONB DEFAULT '[]',
  buyer_info JSONB DEFAULT '{}',
  delivery_info JSONB DEFAULT '{}',
  is_lost BOOLEAN DEFAULT false,
  lost_reason TEXT,
  lost_detected_at TIMESTAMPTZ,
  commission_amount NUMERIC DEFAULT 0,
  logistics_cost NUMERIC DEFAULT 0,
  packaging_cost NUMERIC DEFAULT 0,
  net_profit NUMERIC DEFAULT 0,
  label_url TEXT,
  label_generated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(uzum_account_id, order_code)
);

-- 4. unit_economics: Commission rates, logistics fees, packaging costs
CREATE TABLE public.uzum_unit_economics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uzum_account_id UUID REFERENCES public.uzum_accounts(id) ON DELETE CASCADE,
  uzum_product_id UUID REFERENCES public.uzum_products(id) ON DELETE SET NULL,
  sku TEXT,
  product_name TEXT,
  sale_price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  commission_rate NUMERIC DEFAULT 20,
  commission_amount NUMERIC GENERATED ALWAYS AS (sale_price * commission_rate / 100) STORED,
  logistics_fee NUMERIC DEFAULT 0,
  packaging_cost NUMERIC DEFAULT 0,
  return_rate_percent NUMERIC DEFAULT 5,
  return_cost NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 12,
  tax_amount NUMERIC GENERATED ALWAYS AS (sale_price * 12 / 100) STORED,
  other_expenses NUMERIC DEFAULT 0,
  total_expenses NUMERIC GENERATED ALWAYS AS (
    (sale_price * commission_rate / 100) + logistics_fee + packaging_cost + return_cost + (sale_price * 12 / 100) + other_expenses
  ) STORED,
  net_profit NUMERIC GENERATED ALWAYS AS (
    sale_price - cost_price - (sale_price * commission_rate / 100) - logistics_fee - packaging_cost - return_cost - (sale_price * 12 / 100) - other_expenses
  ) STORED,
  roi_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN cost_price > 0 THEN 
      ((sale_price - cost_price - (sale_price * commission_rate / 100) - logistics_fee - packaging_cost - return_cost - (sale_price * 12 / 100) - other_expenses) / cost_price * 100)
    ELSE 0 END
  ) STORED,
  margin_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN sale_price > 0 THEN 
      ((sale_price - cost_price - (sale_price * commission_rate / 100) - logistics_fee - packaging_cost - return_cost - (sale_price * 12 / 100) - other_expenses) / sale_price * 100)
    ELSE 0 END
  ) STORED,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Extension WebSocket commands table
CREATE TABLE public.uzum_extension_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uzum_account_id UUID REFERENCES public.uzum_accounts(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL CHECK (command_type IN ('create_product', 'update_product', 'toggle_boost', 'generate_label', 'scrape_data', 'sync_orders')),
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Enable RLS on all tables
ALTER TABLE public.uzum_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzum_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzum_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzum_unit_economics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzum_extension_commands ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "Users manage own uzum accounts" ON public.uzum_accounts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own uzum products" ON public.uzum_products FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own uzum orders" ON public.uzum_orders FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own unit economics" ON public.uzum_unit_economics FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own extension commands" ON public.uzum_extension_commands FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Enable realtime for extension commands (WebSocket)
ALTER PUBLICATION supabase_realtime ADD TABLE public.uzum_extension_commands;

-- Indexes for performance
CREATE INDEX idx_uzum_products_account ON public.uzum_products(uzum_account_id);
CREATE INDEX idx_uzum_products_sku ON public.uzum_products(sku);
CREATE INDEX idx_uzum_orders_account ON public.uzum_orders(uzum_account_id);
CREATE INDEX idx_uzum_orders_status ON public.uzum_orders(status);
CREATE INDEX idx_uzum_orders_created ON public.uzum_orders(created_at_uzum);
CREATE INDEX idx_uzum_unit_economics_user ON public.uzum_unit_economics(user_id);
CREATE INDEX idx_uzum_extension_commands_status ON public.uzum_extension_commands(user_id, status);
