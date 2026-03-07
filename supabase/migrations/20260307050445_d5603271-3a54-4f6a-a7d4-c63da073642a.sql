
-- Add activation fee settings to platform_settings
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'free_tier_activation',
  '{"trial_days": 7, "monthly_fee_uzs": 99000, "min_topup_uzs": 300000, "is_active": true}'::jsonb,
  'Bepul tarif uchun sinov muddati va oylik aktivatsiya narxi'
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description;

-- Add activation_status columns to sellercloud_subscriptions
ALTER TABLE sellercloud_subscriptions 
  ADD COLUMN IF NOT EXISTS activation_fee_uzs numeric DEFAULT 99000,
  ADD COLUMN IF NOT EXISTS activation_paid_until timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS activation_trial_ends timestamp with time zone DEFAULT (now() + interval '7 days');
