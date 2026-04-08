import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { useActivityStreak } from '@/hooks/useActivityStreak';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Zap, Briefcase, Crown, Store, Percent, Calendar, Flame, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Zap, zap: Zap, Briefcase, briefcase: Briefcase, Crown, crown: Crown,
  star: Crown, Package: Store, TrendingUp: Zap,
};

const FEATURE_LABELS: Record<string, string> = {
  'sales-dashboard': 'Sotuvlar paneli',
  'orders-management': 'Buyurtmalar boshqaruvi',
  'marketplace-sync': 'Marketplace sinxronizatsiya',
  'cost-price-manager': 'Tannarx kiritish',
  'financial-dashboard': 'P&L Dashboard',
  'stock-forecast': 'Stok prognoz',
  'reports-export': 'Hisobotlar eksport',
  'min-price-protection': 'Min narx himoyasi',
  'inventory-sync': 'Inventar sinxronizatsiya',
  'product-analytics': 'Mahsulot tahlili',
  'abc-analysis': 'ABC-analiz',
  'unit-economy': 'Unit-ekonomika',
  'problematic-products': 'Muammoli mahsulotlar',
  'marketplace-reviews': 'Sharhlar boshqaruvi',
  'wb-seller-analytics': 'WB Seller tahlili',
  'wb-ads-campaigns': 'Reklama kampaniyalari',
  'search-keywords': 'Qidiruv kalit so\'zlari',
  'multi-store': 'Multi-Store',
  'team-management': 'Jamoa boshqaruvi',
  'auto-reorder': 'Avto-buyurtma',
};

// Features unique to each tier (what's NEW in this tier)
const TIER_NEW_FEATURES: Record<string, string[]> = {
  business: ['sales-dashboard', 'orders-management', 'marketplace-sync', 'cost-price-manager',
    'financial-dashboard', 'stock-forecast', 'reports-export', 'min-price-protection',
    'abc-analysis', 'unit-economy', 'problematic-products', 'marketplace-reviews'],
  pro: ['wb-seller-analytics', 'wb-ads-campaigns', 'search-keywords'],
  enterprise: ['multi-store', 'team-management', 'auto-reorder'],
};

const DATA_RETENTION_LABELS: Record<number, string> = {
  7: '7 kunlik tahlillar',
  30: '30 kunlik tahlillar',
  365: 'Yillik tahlillar',
};

interface PlanSelectorProps {
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onGoHome?: () => void;
}

export function PlanSelector({ onSelectPlan, onGoHome }: PlanSelectorProps) {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { language } = useLanguage();
  const { depositBonusRules, streak } = useActivityStreak();
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
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    );
  }

  const activePlans = plans?.filter(p => p.is_active && p.monthly_fee_uzs > 0) || [];

  return (
    <div className="py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Tarifni tanlang</h1>
        <p className="text-sm text-muted-foreground">
          Oylik obuna + AI xizmatlarga chegirma tizimi
        </p>
      </div>

      {/* Deposit bonus hint */}
      {depositBonusRules.length > 0 && (
        <Card className="p-3 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-start gap-2">
            <Gift className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Balans bonuslari:</span>{' '}
              {depositBonusRules.map((r, i) => (
                <span key={r.id}>
                  {i > 0 ? ', ' : ''}
                  {(r.min_amount / 1000).toFixed(0)}k+ → +{r.bonus_percent}%
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {activePlans.map((plan, idx) => {
          const Icon = iconMap[plan.icon || 'star'] || Crown;
          const isPopular = idx === 1; // Biznes
          const newFeatures = TIER_NEW_FEATURES[plan.slug] || [];
          const retentionLabel = DATA_RETENTION_LABELS[plan.data_retention_days] || `${plan.data_retention_days} kunlik`;

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
                    <span className="text-xl font-bold text-foreground">
                      {plan.monthly_fee_uzs >= 1000000
                        ? (plan.monthly_fee_uzs / 1000000).toFixed(plan.monthly_fee_uzs % 1000000 === 0 ? 0 : 3).replace(/\.?0+$/, '')
                        : plan.monthly_fee_uzs.toLocaleString()
                      }
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {plan.monthly_fee_uzs >= 1000000 ? 'mln so\'m/oy' : 'so\'m/oy'}
                    </span>
                  </div>

                  {/* Key badges */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Store className="h-3 w-3" />
                      {plan.max_stores_per_marketplace >= 999 ? 'Cheksiz' : plan.max_stores_per_marketplace} do'kon/MP
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Calendar className="h-3 w-3" />
                      {retentionLabel}
                    </Badge>
                    {plan.balance_discount_percent > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600">
                        <Percent className="h-3 w-3" />
                        AI -{plan.balance_discount_percent}%
                      </Badge>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-1 mb-2">
                    {newFeatures.slice(0, 6).map(key => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>{FEATURE_LABELS[key] || key}</span>
                      </div>
                    ))}
                    {newFeatures.length > 6 && (
                      <div className="text-[10px] text-muted-foreground pl-5">
                        +{newFeatures.length - 6} ta boshqa funksiya
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
