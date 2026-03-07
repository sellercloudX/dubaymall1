
-- Notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'telegram',
  notify_new_orders boolean DEFAULT true,
  notify_low_stock boolean DEFAULT true,
  notify_price_changes boolean DEFAULT false,
  notify_reviews boolean DEFAULT true,
  notify_sync_errors boolean DEFAULT true,
  notify_subscription boolean DEFAULT true,
  notify_promotions boolean DEFAULT false,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel)
);

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add telegram_link_code to profiles for partner bot linking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_link_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_linked boolean DEFAULT false;

-- Updated_at trigger
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;
