
-- Add price to folders
ALTER TABLE public.tutorial_folders ADD COLUMN IF NOT EXISTS price_uzs integer DEFAULT 0;

-- Purchases table to track permanent access
CREATE TABLE public.tutorial_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.tutorial_folders(id) ON DELETE CASCADE,
  price_paid integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, folder_id)
);

ALTER TABLE public.tutorial_purchases ENABLE ROW LEVEL SECURITY;

-- Users can read their own purchases
CREATE POLICY "Users read own purchases" ON public.tutorial_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Insert handled via RPC for security
CREATE POLICY "Users insert own purchases" ON public.tutorial_purchases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins manage purchases" ON public.tutorial_purchases
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RPC to purchase a folder (deduct balance + grant access atomically)
CREATE OR REPLACE FUNCTION public.purchase_tutorial_folder(p_folder_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_price integer;
  v_balance numeric;
  v_new_balance numeric;
  v_already boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if already purchased
  SELECT EXISTS(SELECT 1 FROM tutorial_purchases WHERE user_id = v_user_id AND folder_id = p_folder_id) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('success', true, 'message', 'already_purchased');
  END IF;

  -- Get folder price
  SELECT COALESCE(price_uzs, 0) INTO v_price FROM tutorial_folders WHERE id = p_folder_id;
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Papka topilmadi');
  END IF;

  -- Free folder
  IF v_price <= 0 THEN
    INSERT INTO tutorial_purchases (user_id, folder_id, price_paid) VALUES (v_user_id, p_folder_id, 0);
    RETURN jsonb_build_object('success', true, 'price', 0);
  END IF;

  -- Check balance
  SELECT COALESCE(balance_uzs, 0) INTO v_balance FROM user_balances WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'price', v_price, 'balance', COALESCE(v_balance, 0));
  END IF;

  -- Deduct balance
  v_new_balance := v_balance - v_price;
  UPDATE user_balances SET balance_uzs = v_new_balance, total_spent = total_spent + v_price, updated_at = now() WHERE user_id = v_user_id;

  -- Log transaction
  INSERT INTO balance_transactions (user_id, amount, balance_after, transaction_type, feature_key, description)
  VALUES (v_user_id, -v_price, v_new_balance, 'spend', 'tutorial_folder', 'Qo''llanma papkasi: ' || p_folder_id);

  -- Grant access
  INSERT INTO tutorial_purchases (user_id, folder_id, price_paid) VALUES (v_user_id, p_folder_id, v_price);

  RETURN jsonb_build_object('success', true, 'price', v_price, 'new_balance', v_new_balance);
END;
$$;
