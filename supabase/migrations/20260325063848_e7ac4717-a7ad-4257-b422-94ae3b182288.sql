-- Enable uzum-card-create and clone-to-uzum features with reasonable pricing
UPDATE feature_pricing SET is_enabled = true, base_price_uzs = 22000, feature_name_uz = 'Uzum kartochka yaratish' WHERE feature_key = 'uzum-card-create';
UPDATE feature_pricing SET is_enabled = true, base_price_uzs = 12000, feature_name_uz = 'Uzum ga klonlash' WHERE feature_key = 'clone-to-uzum';

-- Remove is_premium_only from all features — tarif-based access is handled by check_feature_access via subscription plans
UPDATE feature_pricing SET is_premium_only = false;

-- Fix clone-to-wb key to match what cloner uses (it sends 'clone-to-wildberries')
UPDATE feature_pricing SET feature_key = 'clone-to-wildberries' WHERE feature_key = 'clone-to-wb';