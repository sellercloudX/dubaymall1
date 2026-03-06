
-- Feature pricing table (admin configurable per-feature pricing)
CREATE TABLE public.feature_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  feature_name text NOT NULL,
  feature_name_uz text,
  feature_name_ru text,
  category text DEFAULT 'ai',
  base_price_uzs numeric DEFAULT 0,
  is_enabled boolean DEFAULT true,
  is_free boolean DEFAULT false,
  is_premium_only boolean DEFAULT false,
  elegant_limit integer,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User balances
CREATE TABLE public.user_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance_uzs numeric DEFAULT 0,
  total_deposited numeric DEFAULT 0,
  total_spent numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Balance transactions log
CREATE TABLE public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  transaction_type text NOT NULL,
  feature_key text,
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Elegant tier usage tracking (monthly limits)
CREATE TABLE public.elegant_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_key text NOT NULL,
  usage_month date NOT NULL DEFAULT date_trunc('month', now())::date,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, feature_key, usage_month)
);

-- Enable RLS
ALTER TABLE public.feature_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elegant_usage ENABLE ROW LEVEL SECURITY;

-- Feature pricing: everyone can read, admins can manage
CREATE POLICY "Anyone can view feature pricing" ON public.feature_pricing
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage feature pricing" ON public.feature_pricing
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

-- User balances: users see own, admins see all
CREATE POLICY "Users can view own balance" ON public.user_balances
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all balances" ON public.user_balances
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Users can insert own balance" ON public.user_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own balance" ON public.user_balances
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all balances" ON public.user_balances
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

-- Balance transactions: users see own, admins see all
CREATE POLICY "Users can view own transactions" ON public.balance_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.balance_transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Users can insert own transactions" ON public.balance_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can insert transactions" ON public.balance_transactions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Elegant usage: users see own, admins see all
CREATE POLICY "Users can view own usage" ON public.elegant_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all usage" ON public.elegant_usage
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Users can manage own usage" ON public.elegant_usage
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all usage" ON public.elegant_usage
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

-- Secure function to deduct balance (atomic)
CREATE OR REPLACE FUNCTION public.deduct_balance(
  p_user_id uuid,
  p_amount numeric,
  p_feature_key text,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_new_balance numeric;
BEGIN
  -- Get current balance with lock
  SELECT balance_uzs INTO v_balance
  FROM user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_balance', 'message', 'Balans topilmadi');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance, 'required', p_amount);
  END IF;

  v_new_balance := v_balance - p_amount;

  -- Update balance
  UPDATE user_balances
  SET balance_uzs = v_new_balance,
      total_spent = total_spent + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO balance_transactions (user_id, amount, balance_after, transaction_type, feature_key, description)
  VALUES (p_user_id, -p_amount, v_new_balance, 'spend', p_feature_key, p_description);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Secure function to add balance (admin or payment system)
CREATE OR REPLACE FUNCTION public.add_balance(
  p_user_id uuid,
  p_amount numeric,
  p_type text DEFAULT 'deposit',
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  -- Upsert balance
  INSERT INTO user_balances (user_id, balance_uzs, total_deposited)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance_uzs = user_balances.balance_uzs + p_amount,
      total_deposited = user_balances.total_deposited + p_amount,
      updated_at = now()
  RETURNING balance_uzs INTO v_new_balance;

  -- Log transaction
  INSERT INTO balance_transactions (user_id, amount, balance_after, transaction_type, description, metadata)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_description, p_metadata);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Function to check if user can use a feature (considering tier)
CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_user_id uuid,
  p_feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature feature_pricing%ROWTYPE;
  v_sub sellercloud_subscriptions%ROWTYPE;
  v_balance numeric;
  v_price numeric;
  v_usage integer;
  v_tier text;
BEGIN
  -- Get feature info
  SELECT * INTO v_feature FROM feature_pricing WHERE feature_key = p_feature_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'unknown');
  END IF;

  IF NOT v_feature.is_enabled THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'feature_disabled', 'message', 'Bu funksiya hozirda o''chirilgan');
  END IF;

  -- Get subscription
  SELECT * INTO v_sub FROM sellercloud_subscriptions
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY created_at DESC LIMIT 1;

  -- Determine tier
  IF v_sub.plan_type = 'elegant' AND v_sub.is_active THEN
    v_tier := 'elegant';
  ELSIF v_sub.plan_type = 'premium' AND v_sub.is_active THEN
    v_tier := 'premium';
  ELSE
    v_tier := 'free';
  END IF;

  -- Free feature
  IF v_feature.is_free THEN
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', v_tier);
  END IF;

  -- Premium only check
  IF v_feature.is_premium_only AND v_tier = 'free' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'premium_only', 'message', 'Bu funksiya faqat Premium/Elegant obunachilari uchun');
  END IF;

  -- Elegant tier: check limits
  IF v_tier = 'elegant' THEN
    IF v_feature.elegant_limit IS NOT NULL THEN
      SELECT COALESCE(usage_count, 0) INTO v_usage
      FROM elegant_usage
      WHERE user_id = p_user_id
        AND feature_key = p_feature_key
        AND usage_month = date_trunc('month', now())::date;

      IF v_usage >= v_feature.elegant_limit THEN
        RETURN jsonb_build_object('allowed', false, 'error', 'limit_reached', 'limit', v_feature.elegant_limit, 'used', v_usage, 'message', 'Oylik limit tugadi');
      END IF;
    END IF;
    RETURN jsonb_build_object('allowed', true, 'price', 0, 'tier', 'elegant', 'used', COALESCE(v_usage, 0), 'limit', v_feature.elegant_limit);
  END IF;

  -- Calculate price
  v_price := v_feature.base_price_uzs;
  IF v_tier = 'premium' THEN
    v_price := v_price * 0.7; -- 30% discount
  END IF;

  -- Check balance
  SELECT COALESCE(balance_uzs, 0) INTO v_balance FROM user_balances WHERE user_id = p_user_id;

  IF v_balance < v_price THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'insufficient_balance', 'price', v_price, 'balance', v_balance, 'tier', v_tier);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'price', v_price, 'tier', v_tier, 'balance', v_balance);
END;
$$;

-- Insert default feature prices
INSERT INTO public.feature_pricing (feature_key, feature_name, feature_name_uz, feature_name_ru, category, base_price_uzs, is_free, elegant_limit, sort_order) VALUES
  ('yandex_card_create', 'Yandex Card Creation', 'Yandex kartochka yaratish', 'Создание карточки Яндекс', 'ai', 25000, false, 200, 1),
  ('wb_card_create', 'Wildberries Card Creation', 'Wildberries kartochka yaratish', 'Создание карточки Wildberries', 'ai', 25000, false, 200, 2),
  ('uzum_card_create', 'Uzum Card Creation', 'Uzum kartochka yaratish', 'Создание карточки Uzum', 'ai', 13000, false, 300, 3),
  ('clone_to_yandex', 'Clone to Yandex', 'Yandex ga klonlash', 'Клонирование на Яндекс', 'ai', 2500, false, 500, 4),
  ('clone_to_wb', 'Clone to Wildberries', 'WB ga klonlash', 'Клонирование на WB', 'ai', 600, false, 500, 5),
  ('clone_to_uzum', 'Clone to Uzum', 'Uzum ga klonlash', 'Клонирование на Uzum', 'ai', 600, false, 500, 6),
  ('ai_image_generate', 'AI Image Generation', 'AI rasm yaratish', 'Генерация изображений AI', 'ai', 10000, false, 300, 7),
  ('ai_infographic', 'AI Infographic', 'AI infografika', 'AI инфографика', 'ai', 9000, false, 200, 8),
  ('ai_audit', 'Card Quality Audit', 'Kartochka sifat auditi', 'Аудит качества карточки', 'ai', 2000, false, 500, 9),
  ('ai_scan', 'AI Scanner Pro', 'AI Skanner Pro', 'AI Сканер Про', 'ai', 2500, false, 300, 10),
  ('ai_fix', 'AI Auto-Fix', 'AI avtomatik tuzatish', 'AI авто-исправление', 'ai', 2000, false, 500, 11),
  ('ai_chat', 'AI Chat', 'AI Chat', 'AI Чат', 'ai', 0, true, NULL, 12),
  ('mxik_lookup', 'MXIK Code Lookup', 'MXIK kodni qidirish', 'Поиск MXIK кода', 'tools', 0, true, NULL, 13),
  ('marketplace_sync', 'Marketplace Sync', 'Marketplace sinxronlash', 'Синхронизация маркетплейса', 'sync', 0, true, NULL, 14),
  ('analytics', 'Analytics Dashboard', 'Analitika paneli', 'Панель аналитики', 'analytics', 0, true, NULL, 15),
  ('orders_management', 'Orders Management', 'Buyurtmalar boshqaruvi', 'Управление заказами', 'management', 0, true, NULL, 16),
  ('cost_price', 'Cost Price Manager', 'Tannarx boshqaruvi', 'Управление себестоимостью', 'tools', 0, true, NULL, 17),
  ('profit_calculator', 'Profit Calculator', 'Foyda kalkulyatori', 'Калькулятор прибыли', 'analytics', 0, true, NULL, 18),
  ('price_manager', 'Price Manager', 'Narx boshqaruvi', 'Управление ценами', 'tools', 0, true, NULL, 19),
  ('reports_export', 'Reports Export', 'Hisobotlarni eksport', 'Экспорт отчётов', 'tools', 0, true, NULL, 20);
