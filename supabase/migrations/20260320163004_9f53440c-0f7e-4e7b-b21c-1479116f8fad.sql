
-- Subscription Plans table for admin-managed tariffs
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL, -- starter, business, pro, enterprise
  name text NOT NULL,
  name_uz text,
  name_ru text,
  description text,
  description_uz text,
  description_ru text,
  onetime_price_uzs numeric NOT NULL DEFAULT 0,
  monthly_fee_uzs numeric NOT NULL DEFAULT 0,
  max_stores_per_marketplace integer NOT NULL DEFAULT 1,
  free_card_creation_monthly integer NOT NULL DEFAULT 0,
  free_cloning_monthly integer NOT NULL DEFAULT 0,
  balance_discount_percent integer NOT NULL DEFAULT 0,
  included_feature_keys text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  color text DEFAULT '#3b82f6',
  icon text DEFAULT 'star',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans
CREATE POLICY "Anyone can read active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

-- Only admins can manage plans
CREATE POLICY "Admins can insert plans"
  ON public.subscription_plans FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plans"
  ON public.subscription_plans FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete plans"
  ON public.subscription_plans FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed the 4 plans
INSERT INTO public.subscription_plans (slug, name, name_uz, name_ru, description_uz, onetime_price_uzs, monthly_fee_uzs, max_stores_per_marketplace, free_card_creation_monthly, free_cloning_monthly, balance_discount_percent, sort_order, color, icon) VALUES
('starter', 'Starter', 'Boshlang''ich', 'Стартовый', '1 ta do''kon, asosiy funksiyalar', 399000, 0, 1, 0, 0, 0, 1, '#6b7280', 'zap'),
('business', 'Business', 'Biznes', 'Бизнес', '3 ta do''kon, +5 bepul funksiya, 20% chegirma', 1499000, 0, 3, 10, 10, 20, 2, '#3b82f6', 'briefcase'),
('pro', 'Pro', 'Professional', 'Профессионал', '5 ta do''kon, 50 kartochka, 40% chegirma', 4999000, 0, 5, 50, 50, 40, 3, '#f59e0b', 'crown'),
('enterprise', 'Enterprise', 'Korporativ', 'Корпоративный', 'Cheksiz do''kon, 100 kartochka, barcha funksiyalar', 5999000, 999000, 999, 100, 100, 50, 4, '#8b5cf6', 'building');

-- Add plan_slug column to sellercloud_subscriptions to link to new plans
ALTER TABLE public.sellercloud_subscriptions 
  ADD COLUMN IF NOT EXISTS plan_slug text REFERENCES public.subscription_plans(slug);

-- Update existing subscriptions to map to new plan slugs
UPDATE public.sellercloud_subscriptions SET plan_slug = 'starter' WHERE plan_type IN ('free', 'pro') AND plan_slug IS NULL;
UPDATE public.sellercloud_subscriptions SET plan_slug = 'pro' WHERE plan_type = 'premium' AND plan_slug IS NULL;
UPDATE public.sellercloud_subscriptions SET plan_slug = 'enterprise' WHERE plan_type IN ('enterprise', 'elegant') AND plan_slug IS NULL;
