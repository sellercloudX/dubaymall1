-- Add SellZen Studio Image Generation feature if missing
INSERT INTO feature_pricing (feature_key, feature_name, feature_name_uz, feature_name_ru, category, base_price_uzs, billing_type, is_enabled, is_free, sort_order, description)
VALUES ('sellzen-image-generate', 'SellZen Image Generation', 'SellZen rasm generatsiya', 'SellZen генерация изображений', 'ai_tools', 8000, 'per_use', true, false, 24, 'SellZen Studio orqali professional mahsulot rasmlari yaratish')
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  feature_name_uz = EXCLUDED.feature_name_uz,
  feature_name_ru = EXCLUDED.feature_name_ru,
  base_price_uzs = EXCLUDED.base_price_uzs,
  is_enabled = EXCLUDED.is_enabled,
  description = EXCLUDED.description;

-- Update old features with proper names
UPDATE feature_pricing SET feature_name_uz = 'AI Skaner Pro', feature_name_ru = 'AI Сканер Про' WHERE feature_key = 'ai-scanner-pro';
UPDATE feature_pricing SET feature_name_uz = 'AI Rasm generatsiya', feature_name_ru = 'AI Генерация изображений' WHERE feature_key = 'ai-image-generate';
UPDATE feature_pricing SET feature_name_uz = 'AI Infografika', feature_name_ru = 'AI Инфографика' WHERE feature_key = 'ai-infographic';
UPDATE feature_pricing SET feature_name_uz = 'AI Video generatsiya', feature_name_ru = 'AI Генерация видео' WHERE feature_key = 'ai_video_generation';
UPDATE feature_pricing SET feature_name_uz = 'AI Chat', feature_name_ru = 'AI Чат' WHERE feature_key = 'ai-chat';
UPDATE feature_pricing SET feature_name_uz = 'Kartochka sifat auditi', feature_name_ru = 'Аудит качества карточки' WHERE feature_key = 'ai-card-audit';
UPDATE feature_pricing SET feature_name_uz = 'AI Avtomatik tuzatish', feature_name_ru = 'AI Автоисправление' WHERE feature_key = 'ai-card-fix';
UPDATE feature_pricing SET feature_name_uz = 'AI Sharh javobi', feature_name_ru = 'AI Ответ на отзыв' WHERE feature_key = 'ai-review-reply';
UPDATE feature_pricing SET feature_name_uz = 'Raqobatchi narx monitoring', feature_name_ru = 'Мониторинг цен конкурентов' WHERE feature_key = 'competitor-monitor';
UPDATE feature_pricing SET feature_name_uz = 'SEO Monitor', feature_name_ru = 'SEO Мониторинг' WHERE feature_key = 'seo-monitor';
UPDATE feature_pricing SET feature_name_uz = 'Qidiruv kalit sozlari', feature_name_ru = 'Поисковые ключевые слова' WHERE feature_key = 'search-keywords';
UPDATE feature_pricing SET feature_name_uz = 'Sotuvlar paneli', feature_name_ru = 'Панель продаж' WHERE feature_key = 'sales-dashboard';
UPDATE feature_pricing SET feature_name_uz = 'Mahsulot analitikasi', feature_name_ru = 'Аналитика продуктов' WHERE feature_key = 'product-analytics';
UPDATE feature_pricing SET feature_name_uz = 'Zaxira prognozi', feature_name_ru = 'Прогноз запасов' WHERE feature_key = 'stock-forecast';
UPDATE feature_pricing SET feature_name_uz = 'Narx qollash', feature_name_ru = 'Применение цены' WHERE feature_key = 'price-apply';
UPDATE feature_pricing SET feature_name_uz = 'Tannarx boshqarish', feature_name_ru = 'Управление себестоимостью' WHERE feature_key = 'cost-price-manager';
UPDATE feature_pricing SET feature_name_uz = 'Foyda kalkulyatori', feature_name_ru = 'Калькулятор прибыли' WHERE feature_key = 'profit-calculator';
UPDATE feature_pricing SET feature_name_uz = 'Minimum narx himoyasi', feature_name_ru = 'Защита минимальной цены' WHERE feature_key = 'min-price-protection';
UPDATE feature_pricing SET feature_name_uz = 'Marketplace ulanish', feature_name_ru = 'Подключение маркетплейса' WHERE feature_key = 'marketplace-connect';
UPDATE feature_pricing SET feature_name_uz = 'Marketplace sinxronizatsiya', feature_name_ru = 'Синхронизация маркетплейса' WHERE feature_key = 'marketplace-sync';
UPDATE feature_pricing SET feature_name_uz = 'Inventar sinxronizatsiya', feature_name_ru = 'Синхронизация инвентаря' WHERE feature_key = 'inventory-sync';
UPDATE feature_pricing SET feature_name_uz = 'Avtomatik qayta buyurtma', feature_name_ru = 'Автоматический перезаказ' WHERE feature_key = 'auto-reorder';
UPDATE feature_pricing SET feature_name_uz = 'Unit iqtisodiyot', feature_name_ru = 'Юнит-экономика' WHERE feature_key = 'unit-economy';
UPDATE feature_pricing SET feature_name_uz = 'Muammoli mahsulotlar', feature_name_ru = 'Проблемные товары' WHERE feature_key = 'problematic-products';
UPDATE feature_pricing SET feature_name_uz = 'Kop dokon boshqaruvi', feature_name_ru = 'Мультимагазин' WHERE feature_key = 'multi-store';
UPDATE feature_pricing SET feature_name_uz = 'Jamoa boshqaruvi', feature_name_ru = 'Управление командой' WHERE feature_key = 'team-management';