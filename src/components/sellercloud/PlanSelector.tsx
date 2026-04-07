import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Zap, Briefcase, Crown, Building, Store, Image, Copy, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Zap: Zap, zap: Zap, Briefcase: Briefcase, briefcase: Briefcase, 
  Crown: Crown, crown: Crown, Building: Building, building: Building, 
  star: Crown, Package: Store, TrendingUp: Zap,
};

interface PlanSelectorProps {
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onGoHome?: () => void;
}

export function PlanSelector({ onSelectPlan, onGoHome }: PlanSelectorProps) {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { language } = useLanguage();
  const lang = (language || 'uz') as 'uz' | 'ru' | 'en';

  const getName = (p: SubscriptionPlan) => {
    if (lang === 'ru') return p.name_ru || p.name;
    if (lang === 'uz') return p.name_uz || p.name;
    return p.name;
  };

  const getDesc = (p: SubscriptionPlan) => {
    if (lang === 'ru') return p.description_ru || p.description || '';
    if (lang === 'uz') return p.description_uz || p.description || '';
    return p.description || '';
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    );
  }

  const activePlans = plans?.filter(p => p.is_active) || [];

  return (
    <div className="py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Tarifni tanlang</h1>
        <p className="text-sm text-muted-foreground">Biznesingizga mos rejani tanlang</p>
      </div>

      <div className="grid gap-4">
        {activePlans.map((plan, idx) => {
          const Icon = iconMap[plan.icon || 'star'] || Crown;
          const isPopular = idx === 2; // Pro

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative p-5 border-2 transition-all hover:shadow-lg active:scale-[0.98]',
                isPopular ? 'border-primary shadow-md' : 'border-border'
              )}
            >
              {isPopular && (
                <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px]">
                  Eng mashhur
                </Badge>
              )}

              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: (plan.color || '#3b82f6') + '15', color: plan.color || '#3b82f6' }}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base text-foreground">{getName(plan)}</h3>
                  </div>

                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-xl font-bold text-foreground">
                      {plan.onetime_price_uzs.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">so'm</span>
                    {plan.monthly_fee_uzs > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        + {plan.monthly_fee_uzs.toLocaleString()}/oy
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                      <Store className="h-3 w-3 shrink-0" />
                      <span>{plan.max_stores_per_marketplace >= 999 ? 'Cheksiz' : plan.max_stores_per_marketplace} do'kon/MP</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Image className="h-3 w-3 shrink-0" />
                      <span>{plan.free_card_creation_monthly || 0} kartochka/oy</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Copy className="h-3 w-3 shrink-0" />
                      <span>{plan.free_cloning_monthly || 0} klon/oy</span>
                    </div>
                    {plan.balance_discount_percent > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Percent className="h-3 w-3 shrink-0" />
                        <span>{plan.balance_discount_percent}% chegirma</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">{getDesc(plan)}</p>
                </div>
              </div>

              <Button
                className="w-full mt-4"
                variant={isPopular ? 'default' : 'outline'}
                onClick={() => onSelectPlan(plan)}
              >
                <Check className="h-4 w-4 mr-1.5" /> Tanlash
              </Button>
            </Card>
          );
        })}
      </div>

      {onGoHome && (
        <div className="text-center">
          <Button variant="ghost" onClick={onGoHome}>← Bosh sahifaga qaytish</Button>
        </div>
      )}
    </div>
  );
}
