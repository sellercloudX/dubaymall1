import React, { useEffect, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useMarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { calculateTotalRevenue } from '@/lib/revenueCalculations';
import { useAutoNotifications } from '@/hooks/useAutoNotifications';
import { useAutoSync } from '@/hooks/useAutoSync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { 
  Loader2, Globe, Package, ShoppingCart, BarChart3, 
  Scan, AlertTriangle, RefreshCw, MessageCircle, CreditCard
} from 'lucide-react';
import { MarketplaceLogo, MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';
import { PlanSelector } from '@/components/sellercloud/PlanSelector';
import { OnboardingWizard } from '@/components/sellercloud/OnboardingWizard';
import { SellerCloudSidebar, sellerMenuItems } from '@/components/sellercloud/SellerCloudSidebar';
import { FeatureGate } from '@/components/sellercloud/FeatureGate';
import { UpgradeTrigger } from '@/components/sellercloud/UpgradeTrigger';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useMarketplaceRealtime } from '@/hooks/useMarketplaceRealtime';


// Lazy load heavy tab components
const MarketplaceOAuth = lazy(() => import('@/components/sellercloud/MarketplaceOAuth').then(m => ({ default: m.MarketplaceOAuth })));
const MarketplaceProducts = lazy(() => import('@/components/sellercloud/MarketplaceProducts').then(m => ({ default: m.MarketplaceProducts })));
const MarketplaceOrders = lazy(() => import('@/components/sellercloud/MarketplaceOrders').then(m => ({ default: m.MarketplaceOrders })));
const FBSOrderManager = lazy(() => import('@/components/sellercloud/FBSOrderManager').then(m => ({ default: m.FBSOrderManager })));
const MarketplaceAnalytics = lazy(() => import('@/components/sellercloud/MarketplaceAnalytics').then(m => ({ default: m.MarketplaceAnalytics })));
const NotificationCenter = lazy(() => import('@/components/sellercloud/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const ReportsExport = lazy(() => import('@/components/sellercloud/ReportsExport').then(m => ({ default: m.ReportsExport })));
const SubscriptionBilling = lazy(() => import('@/components/sellercloud/SubscriptionBilling').then(m => ({ default: m.SubscriptionBilling })));
const FinancialDashboard = lazy(() => import('@/components/sellercloud/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const ABCAnalysis = lazy(() => import('@/components/sellercloud/ABCAnalysis').then(m => ({ default: m.ABCAnalysis })));
const CardCloner = lazy(() => import('@/components/sellercloud/CardCloner').then(m => ({ default: m.CardCloner })));
const ProblematicProducts = lazy(() => import('@/components/sellercloud/ProblematicProducts').then(m => ({ default: m.ProblematicProducts })));
const MxikImport = lazy(() => import('@/components/sellercloud/MxikImport').then(m => ({ default: m.MxikImport })));
const MxikLookup = lazy(() => import('@/components/sellercloud/MxikLookup').then(m => ({ default: m.MxikLookup })));
const CostPriceManager = lazy(() => import('@/components/sellercloud/CostPriceManager').then(m => ({ default: m.CostPriceManager })));
const AIScannerPro = lazy(() => import('@/components/seller/AIScannerPro').then(m => ({ default: m.AIScannerPro })));
const MarketplaceReviews = lazy(() => import('@/components/sellercloud/MarketplaceReviews').then(m => ({ default: m.MarketplaceReviews })));
const MarketplaceAdsCampaigns = lazy(() => import('@/components/sellercloud/MarketplaceAdsCampaigns').then(m => ({ default: m.MarketplaceAdsCampaigns })));
const SupportChat = lazy(() => import('@/components/sellercloud/SupportChat').then(m => ({ default: m.SupportChat })));
const SalesDashboard = lazy(() => import('@/components/sellercloud/SalesDashboard').then(m => ({ default: m.SalesDashboard })));
const MultiStoreManager = lazy(() => import('@/components/sellercloud/MultiStoreManager').then(m => ({ default: m.MultiStoreManager })));
const UnitEconomyDashboard = lazy(() => import('@/components/sellercloud/UnitEconomyDashboard').then(m => ({ default: m.UnitEconomyDashboard })));
const TeamManager = lazy(() => import('@/components/sellercloud/TeamManager').then(m => ({ default: m.TeamManager })));
const ProfilePasswordSetup = lazy(() => import('@/components/sellercloud/ProfilePasswordSetup').then(m => ({ default: m.ProfilePasswordSetup })));
const TutorialVideos = lazy(() => import('@/components/sellercloud/TutorialVideos').then(m => ({ default: m.TutorialVideos })));
// Consolidated hub components
const InventoryControlHub = lazy(() => import('@/components/sellercloud/InventoryControlHub').then(m => ({ default: m.InventoryControlHub })));
const PriceControlHub = lazy(() => import('@/components/sellercloud/PriceControlHub').then(m => ({ default: m.PriceControlHub })));
const SellZenStudio = lazy(() => import('@/components/sellercloud/SellZenStudio').then(m => ({ default: m.SellZenStudio })));
const MobileTrendHunter = lazy(() => import('@/components/mobile/MobileTrendHunter').then(m => ({ default: m.MobileTrendHunter })));

const TabLoader = React.forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>);
TabLoader.displayName = 'TabLoader';

// Page titles for the top bar
const pageTitles: Record<string, string> = {
  marketplaces: 'Marketplacelar',
  stores: 'Do\'konlar boshqaruvi',
  scanner: 'AI Scanner Pro',
  products: 'Mahsulotlar',
  orders: 'Buyurtmalar',
  sales: 'Sotuvlar hisoboti',
  analytics: 'Umumiy analitika',
  financials: 'Moliyaviy dashboard',
  abc: 'ABC-analiz',
  'cost-prices': 'Tannarx boshqaruvi',
  'stock-forecast': 'Zaxira nazorat',
  pricing: 'Narx boshqaruvi',
  reviews: 'Sharhlar va savollar',
  ads: 'Reklama kampaniyalari',
  'sellzen-studio': 'SellZen AI Studio',
  'trend-hunter': 'Trend Hunter AI',
  problems: 'Muammoli mahsulotlar',
  mxik: 'MXIK kodlar bazasi',
  subscription: 'Obuna va to\'lov',
  reports: 'Hisobotlar',
  notifications: 'Bildirishnomalar',
  
  support: 'Yordam markazi',
  'unit-economy': 'Unit-economy (SKU)',
  team: 'Jamoa boshqaruvi',
  profile: 'Profil sozlamalari',
  tutorials: 'Qo\'llanma',
};

export default function SellerCloudX() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  useExchangeRate();
  
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '').split('?')[0];
    return hash || 'marketplaces';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };
  
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '').split('?')[0];
      if (hash) setActiveTab(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const { 
    connections, 
    isLoading: connectionsLoading, 
    connectMarketplace,
    disconnectMarketplace,
    syncMarketplace,
    fetchMarketplaceData,
    refetch
  } = useMarketplaceConnections();
  
  const {
    subscription,
    accessStatus,
    totalDebt,
    isLoading: subscriptionLoading,
    createSubscription,
  } = useSellerCloudSubscription();
  
  const { data: allPlans } = useSubscriptionPlans();
  const connectedMarketplaces = useMemo(() => connections.map(c => c.marketplace), [connections]);
  const store = useMarketplaceDataStore(connectedMarketplaces);
  useAutoNotifications(connectedMarketplaces, store);
  useMarketplaceRealtime(connectedMarketplaces);

  const currentPlanName = useMemo(() => {
    if (!subscription || !allPlans) return 'Free';
    const plan = allPlans.find(p => p.slug === subscription.plan_type);
    return plan?.name || 'Free';
  }, [subscription, allPlans]);
  
  const totalRevenue = useMemo(() => {
    if (store.allOrders.length === 0) return connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
    return calculateTotalRevenue(store.getOrders, connectedMarketplaces);
  }, [store.dataVersion, connections, connectedMarketplaces]);

  const handleMarketplaceConnect = async (marketplace: string) => {
    await refetch();
    toast.success(`${marketplace} ma'lumotlari yangilandi`);
  };

  useEffect(() => {
    if (isMobile && subscription) {
      navigate('/seller-cloud-mobile', { replace: true });
    }
  }, [isMobile, subscription, navigate]);

  // Broadcast auth token to extension via postMessage
  useEffect(() => {
    if (!user) return;
    const broadcastToken = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          window.postMessage({
            type: 'SCX_AUTH_TOKEN',
            accessToken: data.session.access_token,
            userId: user.id,
            userEmail: user.email || '',
          }, '*');
        }
      } catch {}
    };
    broadcastToken();
    const interval = setInterval(broadcastToken, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/seller-cloud');
    }
  }, [user, authLoading, navigate]);
  
  const hasAccess = accessStatus?.is_active ?? false;
  const isBlocked = accessStatus?.blocked === true;
  const daysLeft = accessStatus?.days_left as number | undefined;
  const expiryWarning = accessStatus?.warning === true;
  useAutoSync({ connectedMarketplaces, enabled: !!subscription && !isBlocked, onSyncComplete: refetch });

  // If no subscription, show plan selector instead of auto-creating
  // (removed legacy auto-starter creation)

  if (authLoading || subscriptionLoading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </>
    );
  }

  if (!subscription) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </>
    );
  }

  // Render content based on active tab
  const renderContent = () => {
    // STRICT: If blocked (expired/no payment), only allow subscription tab
    if (isBlocked && activeTab !== 'subscription') {
      return (
        <Card className="mx-auto max-w-lg mt-8 border-destructive/50">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Akkaunt bloklangan</h2>
            <p className="text-muted-foreground">
              Obuna muddatingiz tugagan. Platformadan foydalanish uchun to'lovni amalga oshiring.
              Qarzga xizmat ko'rsatilmaydi.
            </p>
            <Button onClick={() => handleTabChange('subscription')} className="mt-2">
              <CreditCard className="h-4 w-4 mr-2" /> To'lov qilish
            </Button>
          </CardContent>
        </Card>
      );
    }

    // If no access (but not hard-blocked yet), restrict paid tabs
    if (!hasAccess && !['subscription', 'support'].includes(activeTab)) {
      return <SubscriptionBilling totalSalesVolume={totalRevenue} />;
    }

    switch (activeTab) {
      case 'marketplaces':
        return <MarketplaceOAuth connections={connections} isLoading={connectionsLoading} connectMarketplace={connectMarketplace} disconnectMarketplace={disconnectMarketplace} syncMarketplace={syncMarketplace} onConnect={handleMarketplaceConnect} store={store} />;
      case 'stores':
        return <MultiStoreManager connectedMarketplaces={connectedMarketplaces} onStoreChange={() => refetch()} />;
      case 'scanner':
        return connectedMarketplaces.length > 0 
          ? <AIScannerPro shopId="sellercloud" /> 
          : <EmptyState icon={Scan} title="AI Scanner Pro" desc="Avval kamida bitta marketplace ulang" />;
      case 'products':
        return <MarketplaceProducts connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'orders':
        return <FBSOrderManager connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'sales':
        return <SalesDashboard connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'analytics':
        return <MarketplaceAnalytics connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'financials':
        return <FinancialDashboard connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'abc':
        return <ABCAnalysis connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'cost-prices':
        return <CostPriceManager connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'unit-economy':
        return <UnitEconomyDashboard connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'stock-forecast':
        return <InventoryControlHub connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'pricing':
        return <PriceControlHub connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'reviews':
        return <MarketplaceReviews connectedMarketplaces={connectedMarketplaces} />;
      case 'ads':
        return <MarketplaceAdsCampaigns connectedMarketplaces={connectedMarketplaces} />;
      case 'clone':
        return <CardCloner connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'sellzen-studio':
        return <SellZenStudio />;
      case 'trend-hunter':
        return <MobileTrendHunter />;
      case 'problems':
        return <ProblematicProducts connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'mxik':
        return (
          <div className="space-y-6">
            <MxikLookup />
            <MxikImport />
          </div>
        );
      case 'team':
        return <TeamManager />;
      case 'profile':
        return <ProfilePasswordSetup />;
      case 'subscription':
        return <SubscriptionBilling totalSalesVolume={totalRevenue} />;
      case 'reports':
        return <ReportsExport connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'notifications':
        return <NotificationCenter />;
      case 'tutorials':
        return <TutorialVideos />;
      case 'support':
        return <SupportChat />;
      default:
        return <MarketplaceOAuth connections={connections} isLoading={connectionsLoading} connectMarketplace={connectMarketplace} disconnectMarketplace={disconnectMarketplace} syncMarketplace={syncMarketplace} onConnect={handleMarketplaceConnect} store={store} />;
    }
  };

  const formatRevenue = (r: number) => r >= 1000000 ? (r / 1000000).toFixed(1) + ' mln' : new Intl.NumberFormat('uz-UZ').format(r);

  return (
      <div className="flex min-h-screen bg-background w-full">
        <SellerCloudSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          connectedMarketplaces={connectedMarketplaces}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-20">
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-semibold text-foreground truncate">{pageTitles[activeTab] || 'SellerCloudX'}</h1>
              <p className="text-[11px] lg:text-xs text-muted-foreground truncate">SellerCloudX marketplace avtomatizatsiya</p>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 shrink-0">
              {store.hasError && (
                <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${store.isFetching ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">Yangilash</span>
                </Button>
              )}
              <Badge variant="secondary" className="text-xs">{currentPlanName}</Badge>
            </div>
          </header>

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-card/40">
            <StatCard label="Ulangan marketplace" value={connectedMarketplaces.length} />
            <StatCard label="Jami mahsulotlar" value={store.totalProducts} />
            <StatCard label="Jami buyurtmalar" value={store.totalOrders} />
            <StatCard label="Jami daromad (so'm)" value={formatRevenue(totalRevenue)} highlight />
          </div>

          {/* Upgrade trigger */}
          <div className="px-4 lg:px-6 pt-3">
            <UpgradeTrigger onNavigateToSubscription={() => handleTabChange('subscription')} />
          </div>

          {/* Alerts */}
          {accessStatus && !accessStatus.is_active && (
            <div className="px-6 pt-4">
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-700 dark:text-yellow-400 text-sm">Bepul rejada foydalanmoqdasiz</h4>
                      <p className="text-xs text-muted-foreground mt-1">Bepul funksiyalardan foydalanishingiz mumkin. Pullik xizmatlar uchun aktivatsiya talab etiladi.</p>
                      {totalDebt > 0 && <p className="font-medium text-sm mt-1">Qarzdorlik: {new Intl.NumberFormat('uz-UZ').format(totalDebt)} so'm</p>}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleTabChange('subscription')}>Obuna</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {store.hasError && (
            <div className="px-6 pt-4">
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-xs text-muted-foreground flex-1">Ba'zi marketplace ma'lumotlari yuklanmadi.</p>
                    <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching}>
                      <RefreshCw className={`h-3.5 w-3.5 ${store.isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {/* Onboarding wizard for new users */}
            {hasAccess && connectedMarketplaces.length === 0 && (
              <OnboardingWizard
                connectedMarketplaces={connectedMarketplaces}
                trialEndsAt={accessStatus?.expires_at as string | undefined}
                onNavigate={handleTabChange}
                onDismiss={() => {}}
              />
            )}
            <Suspense fallback={<TabLoader />}>
              <FeatureGate tabId={activeTab} onNavigateToSubscription={() => handleTabChange('subscription')}>
                {renderContent()}
              </FeatureGate>
            </Suspense>
          </main>
        </div>

        {/* Floating support chat button */}
        {activeTab !== 'support' && (
          <button
            onClick={() => handleTabChange('support')}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
            title="Admin bilan chat"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        )}
      </div>
  );
}

// Small stat card for the top bar
const StatCard = React.forwardRef<HTMLDivElement, { label: string; value: string | number; highlight?: boolean }>(
  ({ label, value, highlight }, ref) => (
    <div ref={ref} className="flex flex-col gap-0.5 min-w-0">
      <span className={`text-lg lg:text-xl font-bold truncate ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
      <span className="text-[11px] lg:text-xs text-muted-foreground truncate">{label}</span>
    </div>
  )
);
StatCard.displayName = 'StatCard';

// Empty state placeholder
function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
