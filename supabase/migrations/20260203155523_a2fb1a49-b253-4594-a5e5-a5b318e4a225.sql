-- Categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_uz TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Categories are public read
CREATE POLICY "Categories are viewable by everyone" 
ON public.categories FOR SELECT USING (true);

-- Shops table
CREATE TABLE public.shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rating DECIMAL(2,1) DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Shop policies
CREATE POLICY "Shops are viewable by everyone" 
ON public.shops FOR SELECT USING (true);

CREATE POLICY "Users can create their own shop" 
ON public.shops FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shop" 
ON public.shops FOR UPDATE 
USING (auth.uid() = user_id);

-- Products table
CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'inactive', 'out_of_stock');
CREATE TYPE public.product_source AS ENUM ('manual', 'ai', 'dropshipping');

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  original_price DECIMAL(12,2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  status product_status NOT NULL DEFAULT 'draft',
  source product_source NOT NULL DEFAULT 'manual',
  source_url TEXT,
  images TEXT[] DEFAULT '{}',
  specifications JSONB DEFAULT '{}',
  is_affiliate_enabled BOOLEAN DEFAULT false,
  affiliate_commission_percent DECIMAL(4,2) DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Product policies
CREATE POLICY "Active products are viewable by everyone" 
ON public.products FOR SELECT 
USING (status = 'active' OR EXISTS (
  SELECT 1 FROM public.shops WHERE shops.id = products.shop_id AND shops.user_id = auth.uid()
));

CREATE POLICY "Shop owners can create products" 
ON public.products FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shops WHERE shops.id = shop_id AND shops.user_id = auth.uid()
));

CREATE POLICY "Shop owners can update their products" 
ON public.products FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.shops WHERE shops.id = products.shop_id AND shops.user_id = auth.uid()
));

CREATE POLICY "Shop owners can delete their products" 
ON public.products FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.shops WHERE shops.id = products.shop_id AND shops.user_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_shops_updated_at
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.categories (name_uz, name_ru, name_en, slug, icon) VALUES
('Elektronika', 'Электроника', 'Electronics', 'electronics', 'Smartphone'),
('Kiyim-kechak', 'Одежда', 'Clothing', 'clothing', 'Shirt'),
('Uy-ro''zg''or', 'Дом и сад', 'Home & Garden', 'home-garden', 'Home'),
('Sport', 'Спорт', 'Sports', 'sports', 'Dumbbell'),
('Go''zallik', 'Красота', 'Beauty', 'beauty', 'Sparkles'),
('Bolalar uchun', 'Детские товары', 'Kids', 'kids', 'Baby'),
('Avtomobil', 'Автотовары', 'Auto', 'auto', 'Car'),
('Oziq-ovqat', 'Продукты', 'Food', 'food', 'Apple');