
INSERT INTO feature_pricing (feature_key, feature_name, feature_name_uz, category, is_free, is_enabled, base_price_uzs, sort_order) VALUES
  ('multi-store', 'Multi-Store Manager', 'Do''konlar boshqaruvi', 'management', true, true, 0, 5),
  ('ai-scanner-pro', 'AI Scanner Pro', 'AI Scanner Pro', 'ai_tools', false, true, 5000, 6),
  ('sales-dashboard', 'Sales Dashboard', 'Sotuvlar dashboard', 'analytics', true, true, 0, 3),
  ('product-analytics', 'Product Analytics', 'Mahsulot analitika', 'analytics', true, true, 0, 4),
  ('seo-monitor', 'SEO Monitor', 'SEO Monitor', 'analytics', false, true, 15000, 5),
  ('search-keywords', 'Search Keywords', 'Qidiruv so''zlari', 'analytics', false, true, 10000, 6),
  ('unit-economy', 'Unit Economy Analysis', 'Unit-economy analiz', 'analytics', false, true, 20000, 7),
  ('competitor-monitor', 'Competitor Price Monitor', 'Raqobat narx monitoring', 'pricing', false, true, 8000, 5),
  ('stock-forecast', 'Stock Forecast', 'Zaxira prognoz', 'sync', false, true, 12000, 4),
  ('auto-reorder', 'Auto Reorder Alerts', 'Avto buyurtma ogohlantirish', 'sync', false, true, 10000, 5),
  ('problematic-products', 'Problematic Products', 'Muammoli mahsulotlar', 'management', true, true, 0, 6),
  ('team-management', 'Team Management', 'Jamoa boshqaruvi', 'management', false, true, 50000, 7),
  ('ai-review-reply', 'AI Review Reply', 'AI sharx javob', 'ai_tools', false, true, 3000, 7)
ON CONFLICT (feature_key) DO NOTHING;
