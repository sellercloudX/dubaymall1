-- Platform settings table for admin to configure monetization
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can view platform settings"
ON public.platform_settings FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default platform settings
INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
('sales_commission', '{"percent": 5, "is_promo": false, "promo_percent": 0, "promo_end_date": null}', 'Sotuvlardan platform komissiyasi (%)'),
('blogger_platform_fee', '{"percent": 15, "is_promo": false, "promo_percent": 0, "promo_end_date": null}', 'Blogger komissiyasidan platform ulushi (%)'),
('subscription_plans', '{
  "basic": {"price": 0, "name": "Basic", "features": ["5 ta mahsulot", "Asosiy statistika"], "product_limit": 5},
  "pro": {"price": 99000, "name": "Pro", "features": ["50 ta mahsulot", "Kengaytirilgan statistika", "Priority support"], "product_limit": 50},
  "enterprise": {"price": 299000, "name": "Enterprise", "features": ["Cheksiz mahsulot", "Premium statistika", "24/7 support", "API access"], "product_limit": -1}
}', 'Sotuvchi obuna tariflari (som)'),
('promo_period', '{"is_active": false, "name": "", "start_date": null, "end_date": null, "free_subscription": false, "zero_commission": false}', 'Imtiyozli davr sozlamalari');

-- Seller subscriptions tracking
CREATE TABLE public.seller_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'basic',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  payment_status text DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seller_subscriptions ENABLE ROW LEVEL SECURITY;

-- Shop owners can view their subscription
CREATE POLICY "Shop owners can view their subscription"
ON public.seller_subscriptions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE shops.id = seller_subscriptions.shop_id 
  AND shops.user_id = auth.uid()
));

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.seller_subscriptions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can insert subscriptions
CREATE POLICY "System can insert subscriptions"
ON public.seller_subscriptions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE shops.id = seller_subscriptions.shop_id 
  AND shops.user_id = auth.uid()
));

-- Admins can update subscriptions
CREATE POLICY "Admins can update subscriptions"
ON public.seller_subscriptions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Platform revenue tracking
CREATE TABLE public.platform_revenue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type text NOT NULL, -- 'sales_commission', 'blogger_fee', 'subscription'
  source_id uuid, -- order_id, commission_id, or subscription_id
  amount numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

-- Only admins can view revenue
CREATE POLICY "Admins can view platform revenue"
ON public.platform_revenue FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can insert revenue records
CREATE POLICY "System can insert revenue"
ON public.platform_revenue FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_seller_subscriptions_updated_at
BEFORE UPDATE ON public.seller_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();