-- Kategoriya bo'yicha komissiya jadval
CREATE TABLE public.category_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Viloyatlar jadvali
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_uz VARCHAR(100) NOT NULL,
  name_ru VARCHAR(100),
  code VARCHAR(20) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Viloyat bo'yicha yetkazib berish narxlari
CREATE TABLE public.regional_shipping_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id UUID REFERENCES public.regions(id) ON DELETE CASCADE,
  base_rate NUMERIC NOT NULL DEFAULT 0,
  per_kg_rate NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Mahsulotga yetkazib berish maydonlari qo'shish
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS shipping_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC DEFAULT 0;

-- Viloyatlarni qo'shish
INSERT INTO public.regions (name_uz, name_ru, code) VALUES
('Toshkent shahar', 'Город Ташкент', 'tashkent_city'),
('Toshkent viloyati', 'Ташкентская область', 'tashkent_region'),
('Samarqand', 'Самарканд', 'samarkand'),
('Buxoro', 'Бухара', 'bukhara'),
('Andijon', 'Андижан', 'andijan'),
('Fargʻona', 'Фергана', 'fergana'),
('Namangan', 'Наманган', 'namangan'),
('Qashqadaryo', 'Кашкадарья', 'kashkadarya'),
('Surxondaryo', 'Сурхандарья', 'surkhandarya'),
('Jizzax', 'Джизак', 'jizzakh'),
('Sirdaryo', 'Сырдарья', 'syrdarya'),
('Xorazm', 'Хорезм', 'khorezm'),
('Navoiy', 'Навои', 'navoi'),
('Qoraqalpogʻiston', 'Каракалпакстан', 'karakalpakstan');

-- RLS yoqish
ALTER TABLE public.category_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_shipping_rates ENABLE ROW LEVEL SECURITY;

-- Hamma ko'ra olsin (o'qish uchun)
CREATE POLICY "Anyone can view category commissions" ON public.category_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view shipping rates" ON public.regional_shipping_rates FOR SELECT TO authenticated USING (true);

-- Faqat adminlar o'zgartira olsin
CREATE POLICY "Admins can manage category commissions" ON public.category_commissions FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can manage regions" ON public.regions FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can manage shipping rates" ON public.regional_shipping_rates FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_category_commissions_updated_at BEFORE UPDATE ON public.category_commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_regional_shipping_rates_updated_at BEFORE UPDATE ON public.regional_shipping_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();