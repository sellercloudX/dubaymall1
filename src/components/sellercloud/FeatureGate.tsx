import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, TrendingUp, Crown, Zap, BarChart3, Shield, Briefcase, Calendar } from 'lucide-react';

/**
 * FeatureGate v5 — Tier-based feature gating + data retention limits.
 * 
 * Plans: Boshlang'ich (299k) → Biznes (1.499M) → Professional (5.999M)
 * 
 * Data retention: 7 kun | 30 kun | 365 kun
 * Checks plan inclusion AND data retention period.
 */

const TAB_FEATURE_MAP: Record<string, string> = {
  financials: 'financial-dashboard',
  abc: 'abc-analysis',
  'unit-economy': 'unit-economy',
  problems: 'problematic-products',
  reviews: 'marketplace-reviews',
  ads: 'wb-ads-campaigns',
  stores: 'multi-store',
  team: 'team-management',
  'stock-forecast': 'stock-forecast',
  reports: 'reports-export',
  'min-price': 'min-price-protection',
  'inventory-sync': 'inventory-sync',
  'product-analytics': 'product-analytics',
  'wb-analytics': 'wb-seller-analytics',
  'search-keywords': 'search-keywords',
};

const UPGRADE_SUGGESTIONS: Record<string, { planName: string; planSlug: string; icon: React.ElementType; color: string }> = {
  // Biznes (1.499M)
  'wb-seller-analytics': { planName: 'Biznes (1.499M/oy)', planSlug: 'pro', icon: Briefcase, color: 'text-amber-500' },
  'wb-ads-campaigns': { planName: 'Biznes (1.499M/oy)', planSlug: 'pro', icon: Briefcase, color: 'text-amber-500' },
  'search-keywords': { planName: 'Biznes (1.499M/oy)', planSlug: 'pro', icon: Briefcase, color: 'text-amber-500' },
  // Professional (5.999M)
  'multi-store': { planName: 'Professional (5.999M/oy)', planSlug: 'enterprise', icon: Crown, color: 'text-red-500' },
  'team-management': { planName: 'Professional (5.999M/oy)', planSlug: 'enterprise', icon: Crown, color: 'text-red-500' },
  'auto-reorder': { planName: 'Professional (5.999M/oy)', planSlug: 'enterprise', icon: Crown, color: 'text-red-500' },
};

const PERSUASION: Record<string, { title: string; loss: string }> = {
  'financial-dashboard': {
    title: 'P&L tahlili — foydangizni bilib oling',
    loss: 'P&L ko\'rmasdan qaysi mahsulot zarar qilayotganini bilmayapsiz.',
  },
  'stock-forecast': {
    title: 'Stok prognozi — sotuvdan qolmang',
    loss: 'Stok tugab qolsa, kunlik 200k+ daromaddan mahrum bo\'lasiz.',
  },
  'abc-analysis': {
    title: 'ABC-analiz — eng foydali mahsulotlaringiz',
    loss: 'ABC tahlilsiz mahsulot portfelingizning 30% zararlimi — bilmayapsiz.',
  },
  'unit-economy': {
    title: 'Unit-ekonomika — har bir SKU ning haqiqiy foydasi',
    loss: 'Qaysi mahsulot zarar keltiryapti, bilmasdan sotishda davom etyapsiz.',
  },
  'marketplace-reviews': {
    title: 'Sharhlar boshqaruvi — reytingni oshiring',
    loss: 'Salbiy sharhlarga javob bermasangiz, reyting tushadi.',
  },
  'multi-store': {
    title: 'Multi-Store — barcha do\'konlarni boshqaring',
    loss: 'Bir nechta do\'konni alohida boshqarish vaqtingiz va pulingizni sarflaydi.',
  },
  'team-management': {
    title: 'Jamoa boshqaruvi — xodimlarni qo\'shing',
    loss: 'Yolg\'iz ishlash samaradorlikni 3x kamaytiradi.',
  },
  'wb-seller-analytics': {
    title: 'WB Seller tahlili — raqobatchilarni kuzating',
    loss: 'Raqobatchining strategiyasini bilmasangiz, bozorda orqada qolasiz.',
  },
};

interface FeatureGateProps {
  tabId: string;
  children: React.ReactNode;
  onNavigateToSubscription: () => void;
}

export function FeatureGate({ tabId, children, onNavigateToSubscription }: FeatureGateProps) {
  const { subscription } = useSellerCloudSubscription();
  const { data: plans } = useSubscriptionPlans();

  const requiredFeature = TAB_FEATURE_MAP[tabId];
  if (!requiredFeature) return <>{children}</>;

  const userPlanSlug = subscription?.plan_type || 'business';
  const userPlan = plans?.find(p => p.slug === userPlanSlug);
  const includedFeatures = userPlan?.included_feature_keys || [];

  // Check if feature is included in plan
  if (includedFeatures.includes(requiredFeature)) {
    return <>{children}</>;
  }

  // Feature not included — show upgrade gate
  const suggestion = UPGRADE_SUGGESTIONS[requiredFeature];
  const persuasion = PERSUASION[requiredFeature];
  const SuggestIcon = suggestion?.icon || Lock;

  return (
    <Card className="mx-auto max-w-lg mt-8 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardContent className="p-8 text-center space-y-5">
        <div className={`inline-flex p-4 rounded-full bg-amber-500/10 ${suggestion?.color || 'text-amber-500'}`}>
          <SuggestIcon className="h-10 w-10" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold">
            {persuasion?.title || 'Bu funksiya yuqori tarifda mavjud'}
          </h2>
          <p className="text-sm text-destructive font-medium">
            ⚠️ {persuasion?.loss || 'Bu funksiyaga kirish uchun tarifni oshiring'}
          </p>
        </div>

        {suggestion && (
          <div className="bg-card border rounded-lg p-4 text-left space-y-2">
            <p className="text-sm font-medium">
              🔓 Ochish uchun: <span className="text-primary font-bold">{suggestion.planName}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Tarifni oshirsangiz, AI xizmatlarga {suggestion.planSlug === 'pro' ? '15%' : '30%'} chegirma ham olasiz
            </p>
          </div>
        )}

        <Button onClick={onNavigateToSubscription} className="w-full" size="lg">
          <TrendingUp className="h-4 w-4 mr-2" /> Tarifni oshirish
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * DataRetentionGate — wraps analytics components to enforce data period limits.
 * Usage: <DataRetentionGate>{(maxDays) => <FinancialDashboard maxDays={maxDays} />}</DataRetentionGate>
 */
interface DataRetentionGateProps {
  children: (maxDays: number) => React.ReactNode;
}

export function DataRetentionGate({ children }: DataRetentionGateProps) {
  const { subscription } = useSellerCloudSubscription();
  const { data: plans } = useSubscriptionPlans();

  const userPlanSlug = subscription?.plan_type || 'business';
  const userPlan = plans?.find(p => p.slug === userPlanSlug);
  const maxDays = userPlan?.data_retention_days || 7;

  return <>{children(maxDays)}</>;
}
