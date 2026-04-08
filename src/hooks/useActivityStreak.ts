import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  total_bonus_earned: number;
}

interface BonusRule {
  id: string;
  rule_type: 'deposit_bonus' | 'streak_bonus';
  min_amount: number;
  bonus_percent: number;
  bonus_fixed: number;
  description: string;
  is_active: boolean;
}

export function useActivityStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setIsLoading(true);
      try {
        // Record daily activity & get streak
        const { data: streakResult } = await supabase.rpc('record_daily_activity', {
          p_user_id: user.id,
        });

        if (streakResult) {
          setStreak({
            current_streak: (streakResult as any).streak || 0,
            longest_streak: (streakResult as any).longest || 0,
            last_active_date: new Date().toISOString(),
            total_bonus_earned: 0,
          });
        }

        // Fetch bonus rules
        const { data: rules } = await supabase
          .from('balance_bonus_rules')
          .select('*')
          .eq('is_active', true)
          .order('min_amount');

        setBonusRules((rules as BonusRule[]) || []);
      } catch (err) {
        console.error('Streak error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [user]);

  const depositBonusRules = bonusRules.filter(r => r.rule_type === 'deposit_bonus');
  const streakBonusRules = bonusRules.filter(r => r.rule_type === 'streak_bonus');

  // Calculate next streak milestone
  const nextStreakMilestone = streakBonusRules.find(
    r => r.min_amount > (streak?.current_streak || 0)
  );

  // Calculate deposit bonus for a given amount
  const getDepositBonus = (amount: number) => {
    const rule = [...depositBonusRules]
      .reverse()
      .find(r => amount >= r.min_amount);
    return rule ? Math.round(amount * rule.bonus_percent / 100) : 0;
  };

  return {
    streak,
    bonusRules,
    depositBonusRules,
    streakBonusRules,
    nextStreakMilestone,
    getDepositBonus,
    isLoading,
  };
}
