-- Banner va Reklama tizimi
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  link_type TEXT DEFAULT 'external', -- 'external', 'product', 'category', 'shop'
  link_id TEXT, -- product_id, category_id, shop_id
  position TEXT DEFAULT 'hero', -- 'hero', 'middle', 'sidebar', 'popup'
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  priority INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Mahsulot va Do'kon reklama (Boost) tizimi
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'product_boost', 'shop_boost', 'featured'
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
  budget NUMERIC DEFAULT 0,
  spent NUMERIC DEFAULT 0,
  daily_budget NUMERIC,
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Aksiya/Flash Sale tizimi
CREATE TABLE public.flash_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  discount_percent INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Flash Sale mahsulotlari
CREATE TABLE public.flash_sale_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flash_sale_id UUID REFERENCES public.flash_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sale_price NUMERIC NOT NULL,
  stock_limit INTEGER DEFAULT 0,
  sold_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(flash_sale_id, product_id)
);

-- RLS policies
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sale_products ENABLE ROW LEVEL SECURITY;

-- Banners - public read, admin write
CREATE POLICY "Anyone can view active banners" ON public.banners
  FOR SELECT USING (is_active = true AND (end_date IS NULL OR end_date > now()));

CREATE POLICY "Admins can manage banners" ON public.banners
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Promotions - user sees own, admin sees all
CREATE POLICY "Users can view own promotions" ON public.promotions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all promotions" ON public.promotions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create promotions" ON public.promotions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own promotions" ON public.promotions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all promotions" ON public.promotions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Flash sales - public read active, admin write
CREATE POLICY "Anyone can view active flash sales" ON public.flash_sales
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage flash sales" ON public.flash_sales
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Flash sale products - public read
CREATE POLICY "Anyone can view flash sale products" ON public.flash_sale_products
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage flash sale products" ON public.flash_sale_products
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));