import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, TrendingUp, Crown, Zap } from 'lucide-react';

/**
 * FeatureGate v3 — Tier-based feature gating.
 * 
 * Checks if the user's current plan includes the feature (tab).
 * AI usage is still charged per-use from balance.
 * Pure DB/API features are gated by subscription tier.
 */

// Map tab IDs to required feature_keys
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
};

// Which plan unlocks which features (for upgrade messaging)
const UPGRADE_SUGGESTIONS: Record<string, { planName: string; planSlug: string; icon: React.ElementType; color: string }> = {
  'financial-dashboard': { planName: 'Starter (99k/oy)', planSlug: 'business', icon: Zap, color: 'text-blue-500' },
  'stock-forecast': { planName: 'Starter (99k/oy)', planSlug: 'business', icon: Zap, color: 'text-blue-500' },
  'reports-export': { planName: 'Starter (99k/oy)', planSlug: 'business', icon: Zap, color: 'text-blue-500' },
  'abc-analysis': { planName: 'Growth (299k/oy)', planSlug: 'pro', icon: TrendingUp, color: 'text-amber-500' },
  'unit-economy': { planName: 'Growth (299k/oy)', planSlug: 'pro', icon: TrendingUp, color: 'text-amber-500' },
  'problematic-products': { planName: 'Growth (299k/oy)', planSlug: 'pro', icon: TrendingUp, color: 'text-amber-500' },
  'marketplace-reviews': { planName: 'Growth (299k/oy)', planSlug: 'pro', icon: TrendingUp, color: 'text-amber-500' },
  'wb-ads-campaigns': { planName: 'Growth (299k/oy)', planSlug: 'pro', icon: TrendingUp, color: 'text-amber-500' },
  'multi-store': { planName: 'Pro (699k/oy)', planSlug: 'enterprise', icon: Crown, color: 'text-red-500' },
  'team-management': { planName: 'Pro (699k/oy)', planSlug: 'enterprise', icon: Crown, color: 'text-red-500' },
};

// Persuasion messages per feature
const PERSUASION: Record<string, { title: string; loss: string }> = {
  'financial-dashboard': {
    title: 'P&L tahlili — foydangizni bilib oling',
    loss: 'P&L ko\'rmasdan qaysi mahsulot zarar qilayotganini bilmayapsiz. Bu oyda 500k+ zarar bo\'lishi mumkin.',
  },
  'abc-analysis': {
    title: 'ABC-analiz — eng foydali mahsulotlaringiz',
    loss: 'ABC tahlilsiz mahsulot portfelingizning 30% zararlimi — bilmayapsiz.',
  },
  'unit-economy': {
    title: 'Unit-ekonomika — har bir SKU ning haqiqiy foydasi',
    loss: 'Qaysi mahsulot zarar keltiryapti, bilmasdan sotishda davom etyapsiz.',
  },
  'problematic-products': {
    title: 'Muammoli mahsulotlar — zararni toping',
    loss: 'Kam sotilayotgan va zararli mahsulotlar hisobingizdan pul yeyapti.',
  },
  'multi-store': {
    title: 'Multi-Store — barcha do\'konlarni boshqaring',
    loss: 'Bir nechta do\'konni alohida boshqarish vaqtingiz va pulingizni sarflaydi.',
  },
  'team-management': {
    title: 'Jamoa boshqaruvi — xodimlarni qo\'shing',
    loss: 'Yolg\'iz ishlash samaradorlikni 3x kamaytiradi.',
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
  
  // If no feature mapping, tab is always accessible
  if (!requiredFeature) return <>{children}</>;

  // Find user's current plan
  const userPlanSlug = subscription?.plan_type || 'starter';
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
              Tarifni oshirsangiz, AI xizmatlarga {suggestion.planSlug === 'business' ? '10%' : suggestion.planSlug === 'pro' ? '25%' : '50%'} chegirma ham olasiz
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
