
-- 1. marketplace_connections: nullify plaintext credentials
UPDATE public.marketplace_connections SET credentials = '{}'::jsonb WHERE credentials != '{}'::jsonb;
ALTER TABLE public.marketplace_connections ALTER COLUMN credentials DROP NOT NULL;
ALTER TABLE public.marketplace_connections ALTER COLUMN credentials SET DEFAULT '{}'::jsonb;

-- 2. uzum_accounts: nullify plaintext secrets
UPDATE public.uzum_accounts SET api_key = NULL WHERE api_key IS NOT NULL;
UPDATE public.uzum_accounts SET session_token = NULL WHERE session_token IS NOT NULL;

-- 3. seller_withdrawal_requests: restrict to finance admins
DROP POLICY IF EXISTS "Finance admins can view withdrawal requests" ON public.seller_withdrawal_requests;
CREATE POLICY "Finance admins can view withdrawal requests"
  ON public.seller_withdrawal_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = seller_withdrawal_requests.shop_id AND shops.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = auth.uid() AND (is_super_admin = true OR can_manage_finances = true))
  );

-- 4. telegram_link_code auto-clear trigger
CREATE OR REPLACE FUNCTION public.clear_used_telegram_link_code()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET telegram_link_code = NULL WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_clear_telegram_link_code ON public.telegram_chat_links;
CREATE TRIGGER trg_clear_telegram_link_code
  AFTER INSERT ON public.telegram_chat_links
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_used_telegram_link_code();
