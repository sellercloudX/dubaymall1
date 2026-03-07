
-- Insert all feature pricing records for billing integration
INSERT INTO feature_pricing (feature_key, feature_name, feature_name_uz, feature_name_ru, category, base_price_uzs, is_enabled, is_free, is_premium_only, elegant_limit, sort_order, description)
VALUES
  -- Card Creation
  ('yandex-card-create', 'Yandex Card Creation', 'Yandex kartochka yaratish', 'Создание карточки Yandex', 'card_creation', 25000, true, false, false, 200, 1, 'Yandex Market ga kartochka yaratish (AI + rasmlar)'),
  ('wb-card-create', 'WB Card Creation', 'WB kartochka yaratish', 'Создание карточки WB', 'card_creation', 25000, true, false, false, 200, 2, 'Wildberries ga kartochka yaratish (AI + rasmlar)'),
  ('uzum-card-create', 'Uzum Card Creation', 'Uzum kartochka yaratish', 'Создание карточки Uzum', 'card_creation', 13000, true, false, false, 300, 3, 'Uzum Market ga kartochka yaratish'),
  
  -- Cloning
  ('clone-to-yandex', 'Clone to Yandex', 'Yandex ga klonlash', 'Клонирование на Yandex', 'cloning', 2500, true, false, false, 500, 10, 'Boshqa marketplace dan Yandex ga klonlash'),
  ('clone-to-wb', 'Clone to WB', 'WB ga klonlash', 'Клонирование на WB', 'cloning', 600, true, false, false, 500, 11, 'Boshqa marketplace dan WB ga klonlash'),
  ('clone-to-uzum', 'Clone to Uzum', 'Uzum ga klonlash', 'Клонирование на Uzum', 'cloning', 600, true, false, false, 500, 12, 'Boshqa marketplace dan Uzum ga klonlash'),
  
  -- AI Images
  ('ai-image-generate', 'AI Image Generation', 'AI rasm yaratish', 'Генерация AI изображений', 'ai_images', 10000, true, false, false, 300, 20, 'AI orqali mahsulot rasmlari yaratish'),
  ('ai-scanner-images', 'AI Scanner Images', 'Scanner rasmlari', 'Изображения сканера', 'ai_images', 10000, true, false, false, 300, 21, 'AI Scanner orqali rasm yaratish'),
  
  -- AI Fix & Audit
  ('ai-card-fix', 'AI Card Fix', 'AI kartochka tuzatish', 'AI исправление карточки', 'ai_tools', 2500, true, false, false, 500, 30, 'AI orqali kartochka sifatini tuzatish'),
  ('ai-card-audit', 'AI Card Audit', 'AI audit', 'AI аудит карточки', 'ai_tools', 2000, true, false, false, 500, 31, 'Kartochka sifat auditi'),
  
  -- Free features
  ('ai-chat', 'AI Chat', 'AI suhbat', 'AI чат', 'free', 0, true, true, false, null, 40, 'AI yordamchi bilan suhbat'),
  ('marketplace-sync', 'Marketplace Sync', 'Marketplace sinxronlash', 'Синхронизация маркетплейсов', 'free', 0, true, true, false, null, 41, 'Marketplace bilan sinxronlash'),
  ('analytics', 'Analytics & PnL', 'Analitika va PnL', 'Аналитика и PnL', 'free', 0, true, true, false, null, 42, 'Moliyaviy analitika va hisobotlar'),
  ('mxik-lookup', 'MXIK Lookup', 'MXIK qidiruv', 'Поиск MXIK', 'free', 0, true, true, false, null, 43, 'MXIK kod qidirish'),
  ('price-scan', 'Price Scan', 'Narx skanerlash', 'Сканирование цен', 'free', 0, true, true, false, null, 44, 'Narxlarni skanerlash va tahlil'),
  ('price-apply', 'Price Apply', 'Narx qo''llash', 'Применение цен', 'ai_tools', 500, true, false, false, 1000, 45, 'Narxlarni marketplace ga qo''llash')
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  feature_name_uz = EXCLUDED.feature_name_uz,
  feature_name_ru = EXCLUDED.feature_name_ru,
  category = EXCLUDED.category,
  base_price_uzs = EXCLUDED.base_price_uzs,
  is_enabled = EXCLUDED.is_enabled,
  is_free = EXCLUDED.is_free,
  is_premium_only = EXCLUDED.is_premium_only,
  elegant_limit = EXCLUDED.elegant_limit,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;
