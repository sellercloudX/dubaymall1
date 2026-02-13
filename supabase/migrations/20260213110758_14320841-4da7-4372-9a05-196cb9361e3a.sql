-- Create Wildberries connections table
CREATE TABLE IF NOT EXISTS public.wildberries_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_key TEXT NOT NULL,
  supplier_id BIGINT NOT NULL,
  warehouse_id BIGINT,
  account_info JSONB,
  is_active BOOLEAN DEFAULT true,
  products_count INTEGER DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, supplier_id)
);

-- Create Wildberries products cache table
CREATE TABLE IF NOT EXISTS public.wildberries_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES wildberries_connections(id) ON DELETE CASCADE,
  nm_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC,
  discount_percent INTEGER DEFAULT 0,
  rating NUMERIC,
  review_count INTEGER DEFAULT 0,
  stock JSONB,
  images TEXT[],
  category_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, nm_id)
);

-- Create Wildberries orders table
CREATE TABLE IF NOT EXISTS public.wildberries_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES wildberries_connections(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE,
  status TEXT,
  payment_method TEXT,
  total_amount NUMERIC,
  total_price NUMERIC,
  commission_percent NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  warehouse_id INTEGER,
  delivery_address TEXT,
  buyer_name TEXT,
  items JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, order_id)
);

-- Create Wildberries financial data table
CREATE TABLE IF NOT EXISTS public.wildberries_financials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES wildberries_connections(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL,
  revenue NUMERIC,
  commission NUMERIC,
  logistics NUMERIC DEFAULT 0,
  return_amount NUMERIC DEFAULT 0,
  penalty NUMERIC DEFAULT 0,
  net_income NUMERIC,
  date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, order_id)
);

-- Enable RLS
ALTER TABLE public.wildberries_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wildberries_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wildberries_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wildberries_financials ENABLE ROW LEVEL SECURITY;

-- RLS policies for wildberries_connections
CREATE POLICY "Users can view their own connections"
  ON public.wildberries_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections"
  ON public.wildberries_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON public.wildberries_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON public.wildberries_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for wildberries_products
CREATE POLICY "Users can view their own products"
  ON public.wildberries_products
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products"
  ON public.wildberries_products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
  ON public.wildberries_products
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for wildberries_orders
CREATE POLICY "Users can view their own orders"
  ON public.wildberries_orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON public.wildberries_orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
  ON public.wildberries_orders
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for wildberries_financials
CREATE POLICY "Users can view their own financials"
  ON public.wildberries_financials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own financials"
  ON public.wildberries_financials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own financials"
  ON public.wildberries_financials
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_wildberries_connections_user ON public.wildberries_connections(user_id);
CREATE INDEX idx_wildberries_products_user_connection ON public.wildberries_products(user_id, connection_id);
CREATE INDEX idx_wildberries_orders_user_connection ON public.wildberries_orders(user_id, connection_id);
CREATE INDEX idx_wildberries_financials_user_order ON public.wildberries_financials(user_id, order_id);