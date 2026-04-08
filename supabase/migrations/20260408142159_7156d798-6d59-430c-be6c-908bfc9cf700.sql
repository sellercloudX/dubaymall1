
-- Add data_retention_days to subscription_plans
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS data_retention_days integer DEFAULT 7;

-- Activity streak tracking
CREATE TABLE IF NOT EXISTS public.user_activity_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_active_date date,
  total_bonus_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_activity_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks" ON public.user_activity_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks" ON public.user_activity_streaks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks" ON public.user_activity_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Balance bonus rules (admin-managed, public read)
CREATE TABLE IF NOT EXISTS public.balance_bonus_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL, -- 'deposit_bonus' or 'streak_bonus'
  min_amount numeric DEFAULT 0, -- min deposit for deposit_bonus, or streak days for streak_bonus
  bonus_percent numeric DEFAULT 0, -- % bonus for deposits
  bonus_fixed numeric DEFAULT 0, -- fixed bonus amount for streaks
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.balance_bonus_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read bonus rules" ON public.balance_bonus_rules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage bonus rules" ON public.balance_bonus_rules
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default bonus rules
INSERT INTO public.balance_bonus_rules (rule_type, min_amount, bonus_percent, bonus_fixed, description) VALUES
  ('deposit_bonus', 100000, 5, 0, '100k+ to''ldirsangiz +5% bonus'),
  ('deposit_bonus', 500000, 10, 0, '500k+ to''ldirsangiz +10% bonus'),
  ('deposit_bonus', 1000000, 15, 0, '1M+ to''ldirsangiz +15% bonus'),
  ('streak_bonus', 7, 0, 5000, '7 kun ketma-ket kirish — 5,000 so''m bonus'),
  ('streak_bonus', 30, 0, 25000, '30 kun ketma-ket kirish — 25,000 so''m bonus'),
  ('streak_bonus', 90, 0, 100000, '90 kun ketma-ket kirish — 100,000 so''m bonus');

-- Function to record daily activity and check streaks
CREATE OR REPLACE FUNCTION public.record_daily_activity(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_streak record;
  v_today date := current_date;
  v_bonus numeric := 0;
  v_bonus_rule record;
  v_new_streak integer;
BEGIN
  -- Upsert streak record
  INSERT INTO user_activity_streaks (user_id, current_streak, last_active_date)
  VALUES (p_user_id, 1, v_today)
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = CASE
      WHEN user_activity_streaks.last_active_date = v_today THEN user_activity_streaks.current_streak
      WHEN user_activity_streaks.last_active_date = v_today - 1 THEN user_activity_streaks.current_streak + 1
      ELSE 1
    END,
    longest_streak = GREATEST(
      user_activity_streaks.longest_streak,
      CASE
        WHEN user_activity_streaks.last_active_date = v_today THEN user_activity_streaks.current_streak
        WHEN user_activity_streaks.last_active_date = v_today - 1 THEN user_activity_streaks.current_streak + 1
        ELSE 1
      END
    ),
    last_active_date = v_today,
    updated_at = now()
  RETURNING * INTO v_streak;

  v_new_streak := v_streak.current_streak;

  -- Check streak bonuses (only award once per milestone)
  FOR v_bonus_rule IN 
    SELECT * FROM balance_bonus_rules 
    WHERE rule_type = 'streak_bonus' AND is_active = true AND min_amount = v_new_streak
  LOOP
    -- Award bonus
    v_bonus := v_bonus_rule.bonus_fixed;
    PERFORM add_balance(p_user_id, v_bonus, 'streak_bonus', 
      v_new_streak || ' kunlik streak bonusi');
    
    UPDATE user_activity_streaks 
    SET total_bonus_earned = total_bonus_earned + v_bonus 
    WHERE user_id = p_user_id;
  END LOOP;

  RETURN jsonb_build_object(
    'streak', v_new_streak,
    'longest', v_streak.longest_streak,
    'bonus_awarded', v_bonus
  );
END;
$$;
