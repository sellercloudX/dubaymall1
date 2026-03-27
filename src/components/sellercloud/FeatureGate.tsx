import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown, ArrowRight } from 'lucide-react';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';

/**
 * Maps tab/section IDs to feature_pricing feature_keys.
 * Tabs NOT listed here are always accessible (free core features).
 */
const TAB_FEATURE_MAP: Record<string, string> = {
  // AI tools (paid)
  scanner: 'ai_scanner',
  'sellzen-studio': 'sellzen-image-generate',
  'trend-hunter': 'trend_hunter',
  clone: 'clone_card',
  'card-clone': 'clone_card',
  // Analytics (paid tiers)
  'unit-economy': 'unit_economy',
  'product-analytics': 'product_analytics',
  abc: 'abc_analysis',
  'abc-analysis': 'abc_analysis',
  'wb-analytics': 'seller_analytics',
  'seller-analytics': 'seller_analytics',
  'seo-monitor': 'seo_monitor',
  'seo-keywords': 'seo_monitor',
  competitor: 'competitor_monitor',
  ads: 'ads_campaigns',
  // Finance
  financials: 'financial_dashboard',
  // Reports
  reports: 'reports_export',
  // Team
  team: 'team_management',
};

/** Tabs that are always free and never gated */
const ALWAYS_FREE_TABS = new Set([
  'marketplaces', 'stores', 'products', 'orders', 'sales',
  'pricing', 'cost-prices', 'stock-forecast',
  'reviews', 'problems', 'mxik',
  'subscription', 'profile', 'notifications', 'tutorials', 'support',
]);

interface FeatureGateProps {
  tabId: string;
  children: React.ReactNode;
  onNavigateToSubscription: () => void;
}

export function FeatureGate({ tabId, children, onNavigateToSubscription }: FeatureGateProps) {
  const { subscription } = useSellerCloudSubscription();
  const { data: plans } = useSubscriptionPlans();

  const isLocked = useMemo(() => {
    // Always-free tabs → never locked
    if (ALWAYS_FREE_TABS.has(tabId)) return false;

    const featureKey = TAB_FEATURE_MAP[tabId];
    // If no feature key mapped → treat as free
    if (!featureKey) return false;

    // Get current plan
    const currentPlanSlug = (subscription as any)?.plan_slug || subscription?.plan_type;
    if (!currentPlanSlug || !plans) return false;

    const currentPlan = plans.find(p => p.slug === currentPlanSlug);
    if (!currentPlan) return false;

    // Check if feature is included in current plan
    const includedKeys = currentPlan.included_feature_keys || [];
    return !includedKeys.includes(featureKey);
  }, [tabId, subscription, plans]);

  // Find which plans include this feature
  const availablePlans = useMemo(() => {
    if (!isLocked) return [];
    const featureKey = TAB_FEATURE_MAP[tabId];
    if (!featureKey || !plans) return [];
    return plans
      .filter(p => p.is_active && (p.included_feature_keys || []).includes(featureKey))
      .map(p => p.name_uz || p.name);
  }, [isLocked, tabId, plans]);

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred preview of locked content */}
      <div className="pointer-events-none select-none filter blur-[6px] opacity-40 max-h-[300px] overflow-hidden">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
        <Card className="max-w-sm w-full mx-4 border-2 border-primary/20 shadow-xl">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7 text-primary" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">Bu funksiya yopiq</h3>
              <p className="text-sm text-muted-foreground">
                Ushbu funksiyadan foydalanish uchun tarifingizni yangilang
              </p>
            </div>

            {availablePlans.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {availablePlans.map(name => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    <Crown className="h-3 w-3 mr-1" /> {name}
                  </Badge>
                ))}
              </div>
            )}

            <Button onClick={onNavigateToSubscription} className="w-full gap-2">
              <Crown className="h-4 w-4" />
              Tarifni almashtirish
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
