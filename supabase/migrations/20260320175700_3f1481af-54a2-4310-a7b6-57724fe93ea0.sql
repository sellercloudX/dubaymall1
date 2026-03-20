INSERT INTO public.feature_pricing (feature_key, feature_name, feature_name_ru, feature_name_uz, category, base_price_uzs, is_enabled, is_free, sort_order, description)
VALUES ('ai_video_generation', 'AI Video Generation', 'AI Видео генерация', 'AI Video generatsiya', 'ai', 15000, true, false, 25, 'SellZen AI orqali rasmdan video generatsiya')
ON CONFLICT (feature_key) DO NOTHING;