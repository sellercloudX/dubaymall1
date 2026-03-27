-- Add missing AI/analytics feature keys to Enterprise plan
UPDATE subscription_plans 
SET included_feature_keys = array_cat(included_feature_keys, ARRAY['ai_scanner', 'sellzen-image-generate', 'trend_hunter', 'clone_card', 'seller-analytics', 'seo-monitor', 'competitor-monitor', 'ads-campaigns'])
WHERE slug = 'enterprise';

-- Add to Pro plan
UPDATE subscription_plans 
SET included_feature_keys = array_cat(included_feature_keys, ARRAY['ai_scanner', 'sellzen-image-generate', 'trend_hunter', 'clone_card', 'seller-analytics', 'seo-monitor', 'competitor-monitor', 'ads-campaigns'])
WHERE slug = 'pro';

-- Add some to Business plan
UPDATE subscription_plans 
SET included_feature_keys = array_cat(included_feature_keys, ARRAY['ai_scanner', 'clone_card', 'seller-analytics', 'seo-monitor'])
WHERE slug = 'business';