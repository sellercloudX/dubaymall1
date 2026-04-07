import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertTriangle, DollarSign, Zap } from 'lucide-react';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useUserBalance } from '@/hooks/useFeaturePricing';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';

interface UpgradeTriggerProps {
  onNavigateToSubscription: () => void;
}

/**
 * Smart upgrade trigger — shows contextual upgrade prompts based on user behavior.
 * Shows: (1) savings if user would upgrade, (2) loss detection, (3) feature unlock hints
 */
export function UpgradeTrigger({ onNavigateToSubscription }: UpgradeTriggerProps) {
  const { subscription } = useSellerCloudSubscription();
  const { balance, transactions } = useUserBalance();
  const { data: plans } = useSubscriptionPlans();

  const trigger = useMemo(() => {
    if (!subscription || !plans || !transactions) return null;

    const userPlanSlug = subscription.plan_type || 'starter';
    const userPlan = plans.find(p => p.slug === userPlanSlug);
    const currentDiscount = userPlan?.balance_discount_percent || 0;

    // Find next tier
    const sortedPlans = [...plans].sort((a, b) => a.sort_order - b.sort_order);
    const currentIdx = sortedPlans.findIndex(p => p.slug === userPlanSlug);
    const nextPlan = currentIdx >= 0 && currentIdx < sortedPlans.length - 1
      ? sortedPlans[currentIdx + 1]
      : null;

    if (!nextPlan) return null; // Already on highest plan

    // Calculate AI spending in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSpending = transactions
      .filter(t => t.transaction_type === 'deduct' && t.created_at > thirtyDaysAgo)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calculate potential savings
    const nextDiscount = nextPlan.balance_discount_percent;
    const additionalDiscount = nextDiscount - currentDiscount;
    const potentialSavings = Math.round(recentSpending * additionalDiscount / 100);
    const upgradeCost = nextPlan.monthly_fee_uzs - (userPlan?.monthly_fee_uzs || 0);

    // Trigger #1: User spent more than upgrade cost in AI
    if (recentSpending > 0 && potentialSavings > upgradeCost * 0.3) {
      return {
        type: 'savings' as const,
        icon: DollarSign,
        title: `Siz ${formatNum(recentSpending)} so'm sarfladingiz`,
        message: `${nextPlan.name} tarifida ${formatNum(potentialSavings)} so'm tejardingiz (${additionalDiscount}% chegirma)`,
        cta: `${nextPlan.name} ga o'tish — ${formatNum(nextPlan.monthly_fee_uzs)}/oy`,
        color: 'border-emerald-500/30 bg-emerald-500/5',
        iconColor: 'text-emerald-500',
      };
    }

    // Trigger #2: Free user — show what they're missing
    if (userPlanSlug === 'starter' && recentSpending > 0) {
      return {
        type: 'missing' as const,
        icon: AlertTriangle,
        title: 'Foydangizni bilmayapsiz',
        message: 'P&L dashboard ochiq emas. Qaysi mahsulot zarar qilayotganini bilmasdan sotish davom etyapti.',
        cta: `Starter — ${formatNum(99000)}/oy`,
        color: 'border-amber-500/30 bg-amber-500/5',
        iconColor: 'text-amber-500',
      };
    }

    // Trigger #3: Low balance warning
    if (balance && balance.balance_uzs < 50000 && recentSpending > 0) {
      return {
        type: 'balance' as const,
        icon: Zap,
        title: 'Balans kam qoldi',
        message: `${nextPlan.name} tarifiga o'tsangiz, har bir AI ishlatishda ${additionalDiscount}% tejaysiz`,
        cta: 'Tarifni oshirish',
        color: 'border-blue-500/30 bg-blue-500/5',
        iconColor: 'text-blue-500',
      };
    }

    return null;
  }, [subscription, plans, transactions, balance]);

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
