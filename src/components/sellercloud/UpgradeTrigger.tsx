import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertTriangle, DollarSign, Zap, Flame, Gift, Calendar } from 'lucide-react';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useUserBalance } from '@/hooks/useFeaturePricing';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useActivityStreak } from '@/hooks/useActivityStreak';

interface UpgradeTriggerProps {
  onNavigateToSubscription: () => void;
}

/**
 * Smart upgrade trigger v2 — contextual prompts based on behavior + gamification.
 * Shows: savings, data limit, streak, deposit bonus, feature hints
 */
export function UpgradeTrigger({ onNavigateToSubscription }: UpgradeTriggerProps) {
  const { subscription } = useSellerCloudSubscription();
  const { balance, transactions } = useUserBalance();
  const { data: plans } = useSubscriptionPlans();
  const { streak, nextStreakMilestone, getDepositBonus } = useActivityStreak();

  const trigger = useMemo(() => {
    if (!subscription || !plans || !transactions) return null;

    const userPlanSlug = subscription.plan_type || 'business';
    const userPlan = plans.find(p => p.slug === userPlanSlug);
    const currentDiscount = userPlan?.balance_discount_percent || 0;
    const dataRetention = userPlan?.data_retention_days || 7;

    // Find next tier
    const activePlans = plans.filter(p => p.is_active && p.monthly_fee_uzs > 0);
    const sortedPlans = [...activePlans].sort((a, b) => a.monthly_fee_uzs - b.monthly_fee_uzs);
    const currentIdx = sortedPlans.findIndex(p => p.slug === userPlanSlug);
    const nextPlan = currentIdx >= 0 && currentIdx < sortedPlans.length - 1
      ? sortedPlans[currentIdx + 1]
      : null;

    // Calculate AI spending in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSpending = transactions
      .filter(t => t.transaction_type === 'deduct' && t.created_at > thirtyDaysAgo)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Trigger #1: Data retention limit — show if user is on 7-day plan
    if (dataRetention <= 7 && nextPlan) {
      return {
        type: 'data_limit' as const,
        icon: Calendar,
        title: `Faqat 7 kunlik ma'lumot ko'ryapsiz`,
        message: `${nextPlan.name} tarifida ${nextPlan.data_retention_days} kunlik to'liq tahlillar ochiladi`,
        cta: `${nextPlan.name} ga o'tish`,
        color: 'border-purple-500/30 bg-purple-500/5',
        iconColor: 'text-purple-500',
      };
    }

    // Trigger #2: AI savings
    if (nextPlan && recentSpending > 0) {
      const additionalDiscount = nextPlan.balance_discount_percent - currentDiscount;
      const potentialSavings = Math.round(recentSpending * additionalDiscount / 100);
      if (potentialSavings > nextPlan.monthly_fee_uzs * 0.2) {
        return {
          type: 'savings' as const,
          icon: DollarSign,
          title: `Siz ${formatNum(recentSpending)} so'm sarfladingiz`,
          message: `${nextPlan.name} tarifida ${formatNum(potentialSavings)} so'm tejardingiz (-${additionalDiscount}%)`,
          cta: `Tarifni oshirish`,
          color: 'border-emerald-500/30 bg-emerald-500/5',
          iconColor: 'text-emerald-500',
        };
      }
    }

    // Trigger #3: Low balance + deposit bonus
    if (balance && balance.balance_uzs < 50000 && recentSpending > 0) {
      const bonusFor500k = getDepositBonus(500000);
      return {
        type: 'balance' as const,
        icon: Gift,
        title: 'Balans kam qoldi',
        message: `500k to'ldirsangiz +${formatNum(bonusFor500k)} so'm bonus olasiz`,
        cta: 'Balansni to\'ldirish',
        color: 'border-blue-500/30 bg-blue-500/5',
        iconColor: 'text-blue-500',
      };
    }

    return null;
  }, [subscription, plans, transactions, balance, getDepositBonus]);

  if (!trigger) return null;

  const Icon = trigger.icon;

  return (
    <Card className={`${trigger.color} transition-all hover:shadow-md`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${trigger.iconColor} shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{trigger.title}</p>
            <p className="text-xs text-muted-foreground truncate">{trigger.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={onNavigateToSubscription} className="shrink-0 text-xs">
            <TrendingUp className="h-3 w-3 mr-1" /> Oshirish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const formatNum = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);
