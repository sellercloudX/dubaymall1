import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Zap, Briefcase, Crown, Building, Store, Percent, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Zap: Zap, zap: Zap, Briefcase: Briefcase, briefcase: Briefcase, 
  Crown: Crown, crown: Crown, Building: Building, building: Building, 
  star: Crown, Package: Store, TrendingUp: Zap,
};

// Feature labels for display
const FEATURE_LABELS: Record<string, string> = {
  'financial-dashboard': 'P&L Dashboard',
  'stock-forecast': 'Stok prognoz',
  'reports-export': 'Hisobotlar eksport',
  'abc-analysis': 'ABC-analiz',
  'unit-economy': 'Unit-ekonomika',
  'problematic-products': 'Muammoli mahsulotlar',
  'marketplace-reviews': 'Sharhlar boshqaruvi',
  'wb-ads-campaigns': 'Reklama kampaniyalari',
  'multi-store': 'Multi-Store',
  'team-management': 'Jamoa boshqaruvi',
  'auto-reorder': 'Avto-buyurtma',
};

// Features that differentiate each tier (only show NEW features per tier)
const TIER_HIGHLIGHTS: Record<string, string[]> = {
  starter: ['sales-dashboard', 'orders-management', 'marketplace-sync', 'cost-price-manager'],
  business: ['financial-dashboard', 'stock-forecast', 'reports-export', 'min-price-protection', 'inventory-sync', 'product-analytics'],
  pro: ['abc-analysis', 'unit-economy', 'problematic-products', 'marketplace-reviews', 'wb-seller-analytics', 'wb-ads-campaigns'],
  enterprise: ['multi-store', 'team-management', 'auto-reorder'],
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
        <p className="text-sm text-muted-foreground">
          Oylik obuna + AI xizmatlarga chegirma tizimi
        </p>
      </div>

      <div className="grid gap-4">
        {activePlans.map((plan, idx) => {
          const Icon = iconMap[plan.icon || 'star'] || Crown;
          const isPopular = idx === 2;
          const isFree = plan.monthly_fee_uzs === 0;
          const highlights = TIER_HIGHLIGHTS[plan.slug] || [];

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
                  ⭐ Eng mashhur
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

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-3">
                    {isFree ? (
                      <span className="text-xl font-bold text-emerald-500">Bepul</span>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-foreground">
                          {plan.monthly_fee_uzs.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">so'm/oy</span>
                      </>
                    )}
                  </div>

                  {/* Key metrics */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Store className="h-3 w-3" />
                      {plan.max_stores_per_marketplace >= 999 ? 'Cheksiz' : plan.max_stores_per_marketplace} MP
                    </Badge>
                    {plan.balance_discount_percent > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600">
                        <Percent className="h-3 w-3" />
                        AI -{plan.balance_discount_percent}%
                      </Badge>
                    )}
                  </div>

                  {/* Tier-specific features */}
                  <div className="space-y-1 mb-2">
                    {highlights.map(key => {
                      const label = FEATURE_LABELS[key] || key;
                      return (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Unlock className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs text-muted-foreground">{getDesc(plan)}</p>
                </div>
              </div>

              <Button
                className="w-full mt-4"
                variant={isPopular ? 'default' : 'outline'}
                onClick={() => onSelectPlan(plan)}
              >
                <Check className="h-4 w-4 mr-1.5" /> {isFree ? 'Boshlash' : 'Tanlash'}
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
