import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useMarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { calculateTotalRevenue } from '@/lib/revenueCalculations';
import { useAutoNotifications } from '@/hooks/useAutoNotifications';
import { useMarketplaceRealtime } from '@/hooks/useMarketplaceRealtime';
import { MobileSellerCloudNav, type MobileTabType } from '@/components/mobile/MobileSellerCloudNav';
import { MobileSellerCloudHeader } from '@/components/mobile/MobileSellerCloudHeader';
import { BackgroundTasksPanel } from '@/components/mobile/BackgroundTasksPanel';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileMoreMenu } from '@/components/mobile/MobileMoreMenu';
import { PlanSelector } from '@/components/sellercloud/PlanSelector';
import { FeatureGate } from '@/components/sellercloud/FeatureGate';

// Lazy load ALL tab content components for instant tab switching
const MobileAnalytics = lazy(() => import('@/components/mobile/MobileAnalytics').then(m => ({ default: m.MobileAnalytics })));
const MobileProducts = lazy(() => import('@/components/mobile/MobileProducts').then(m => ({ default: m.MobileProducts })));
const MobileOrders = lazy(() => import('@/components/mobile/MobileOrders').then(m => ({ default: m.MobileOrders })));
const AIScannerPro = lazy(() => import('@/components/seller/AIScannerPro').then(m => ({ default: m.AIScannerPro })));
const MarketplaceOAuth = lazy(() => import('@/components/sellercloud/MarketplaceOAuth').then(m => ({ default: m.MarketplaceOAuth })));
const ABCAnalysis = lazy(() => import('@/components/sellercloud/ABCAnalysis').then(m => ({ default: m.ABCAnalysis })));
const CardCloner = lazy(() => import('@/components/sellercloud/CardCloner').then(m => ({ default: m.CardCloner })));
const ProblematicProducts = lazy(() => import('@/components/sellercloud/ProblematicProducts').then(m => ({ default: m.ProblematicProducts })));
const FinancialDashboard = lazy(() => import('@/components/sellercloud/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const ReportsExport = lazy(() => import('@/components/sellercloud/ReportsExport').then(m => ({ default: m.ReportsExport })));
const NotificationCenter = lazy(() => import('@/components/sellercloud/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const SubscriptionBilling = lazy(() => import('@/components/sellercloud/SubscriptionBilling').then(m => ({ default: m.SubscriptionBilling })));
const CostPriceManager = lazy(() => import('@/components/sellercloud/CostPriceManager').then(m => ({ default: m.CostPriceManager })));
const MxikImport = lazy(() => import('@/components/sellercloud/MxikImport').then(m => ({ default: m.MxikImport })));
const MarketplaceReviews = lazy(() => import('@/components/sellercloud/MarketplaceReviews').then(m => ({ default: m.MarketplaceReviews })));
const MarketplaceAdsCampaigns = lazy(() => import('@/components/sellercloud/MarketplaceAdsCampaigns').then(m => ({ default: m.MarketplaceAdsCampaigns })));
const SalesDashboard = lazy(() => import('@/components/sellercloud/SalesDashboard').then(m => ({ default: m.SalesDashboard })));
const SupportChat = lazy(() => import('@/components/sellercloud/SupportChat').then(m => ({ default: m.SupportChat })));
const MultiStoreManager = lazy(() => import('@/components/sellercloud/MultiStoreManager').then(m => ({ default: m.MultiStoreManager })));
const ProfilePasswordSetup = lazy(() => import('@/components/sellercloud/ProfilePasswordSetup').then(m => ({ default: m.ProfilePasswordSetup })));

const TutorialVideos = lazy(() => import('@/components/sellercloud/TutorialVideos').then(m => ({ default: m.TutorialVideos })));
// Consolidated hub components
const InventoryControlHub = lazy(() => import('@/components/sellercloud/InventoryControlHub').then(m => ({ default: m.InventoryControlHub })));
const PriceControlHub = lazy(() => import('@/components/sellercloud/PriceControlHub').then(m => ({ default: m.PriceControlHub })));
const UnitEconomyDashboard = lazy(() => import('@/components/sellercloud/UnitEconomyDashboard').then(m => ({ default: m.UnitEconomyDashboard })));
const SellZenStudio = lazy(() => import('@/components/sellercloud/SellZenStudio').then(m => ({ default: m.SellZenStudio })));
const MobileTrendHunter = lazy(() => import('@/components/mobile/MobileTrendHunter').then(m => ({ default: m.MobileTrendHunter })));

// Lightweight tab loading skeleton
function TabLoader() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

// moreSubTabs moved to MobileMoreMenu component

const primaryTabIds: MobileTabType[] = ['marketplaces', 'analytics', 'scanner', 'products', 'orders'];

export default function SellerCloudMobile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Load real exchange rate from CBU.uz
  useExchangeRate();
  
  const [activeTab, setActiveTabRaw] = useState<MobileTabType>('analytics');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  
  
  const setActiveTab = useCallback((tab: MobileTabType) => {
    setActiveTabRaw(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  
  const { 
    connections, 
    isLoading: connectionsLoading,
    connectMarketplace,
    disconnectMarketplace,
    syncMarketplace,
    refetch
  } = useMarketplaceConnections();
  
  const {
    subscription,
    accessStatus,
    isLoading: subscriptionLoading,
    createSubscription,
  } = useSellerCloudSubscription();
  
   const connectedMarketplaces = useMemo(() => connections.map(c => c.marketplace), [connections]);
   
   // Centralized data store — fetches once, cached for all tabs
    const store = useMarketplaceDataStore(connectedMarketplaces);
    
    // Auto-dispatch Telegram notifications for new orders / low stock
    useAutoNotifications(connectedMarketplaces, store);
    useMarketplaceRealtime(connectedMarketplaces);
   
   // Calculate revenue from actual order data with proper currency conversion
   const totalRevenue = useMemo(() => {
     if (store.allOrders.length === 0) return connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
     return calculateTotalRevenue(store.getOrders, connectedMarketplaces);
   }, [store.allOrders.length, connections, connectedMarketplaces]);

  const handleMarketplaceConnect = async () => {
    await refetch();
    toast.success('Marketplace ma\'lumotlari yangilandi');
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/seller-cloud-mobile');
    }
  }, [user, authLoading, navigate]);

  // If no subscription, show plan selector (removed legacy auto-starter)

  // Early returns AFTER all hooks
  if (authLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-background p-4">
        <PlanSelector onSelectPlan={async (plan) => {
          const result = await createSubscription(plan.slug, plan.monthly_fee_uzs);
          if (result.success) toast.success('Tarif tanlandi!');
        }} />
      </div>
    );
  }

  const hasAccess = accessStatus?.is_active ?? false;
  const isBlocked = (accessStatus as any)?.blocked === true;
  const daysLeft = (accessStatus as any)?.days_left as number | undefined;
  const expiryWarning = (accessStatus as any)?.warning === true;

  const isMoreActive = !primaryTabIds.includes(activeTab);

  const renderContent = () => {
    // STRICT: If blocked, only allow subscription tab
    if (isBlocked && activeTab !== 'subscription') {
      return (
        <div className="p-4">
          <Card className="border-destructive/50">
            <CardContent className="p-6 text-center space-y-3">
              <Lock className="h-10 w-10 text-destructive mx-auto" />
              <h2 className="text-lg font-bold">Akkaunt bloklangan</h2>
              <p className="text-sm text-muted-foreground">
                Obuna muddatingiz tugagan. To'lov qiling.
              </p>
              <Button size="sm" onClick={() => setActiveTab('subscription')}>
                To'lov qilish
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // If no access, restrict paid tabs
    if (!hasAccess && !['subscription', 'notifications'].includes(activeTab)) {
      return <div className="p-4"><SubscriptionBilling totalSalesVolume={totalRevenue} /></div>;
    }

    switch (activeTab) {
      case 'marketplaces':
        return (
          <div className="p-4">
            <MarketplaceOAuth 
              connections={connections} 
              isLoading={connectionsLoading} 
              connectMarketplace={connectMarketplace} 
              disconnectMarketplace={disconnectMarketplace}
              syncMarketplace={syncMarketplace} 
              onConnect={handleMarketplaceConnect}
              store={store}
            />
          </div>
        );
      case 'analytics':
        return <MobileAnalytics connections={connections} connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'scanner':
        return connectedMarketplaces.length > 0
          ? <div className="p-4"><AIScannerPro shopId="sellercloud" /></div>
          : <div className="p-4 text-center text-muted-foreground py-12"><p className="text-lg font-medium">AI Scanner Pro</p><p className="text-sm mt-1">Avval kamida bitta marketplace ulang</p></div>;
      case 'products':
        return <MobileProducts connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'orders':
        return <MobileOrders connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'abc-analysis':
        return <div className="p-4"><ABCAnalysis connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'cost-prices':
        return <div className="p-4"><CostPriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'card-clone':
        return <div className="p-4"><CardCloner connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'problems':
        return <div className="p-4"><ProblematicProducts connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'financials':
        return <div className="p-4"><FinancialDashboard connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'stock-forecast':
        return <div className="p-4"><InventoryControlHub connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'pricing':
        return <div className="p-4"><PriceControlHub connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'reports':
        return <div className="p-4"><ReportsExport connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'notifications':
        return <div className="p-4"><NotificationCenter /></div>;
      case 'subscription':
        return <div className="p-4"><SubscriptionBilling totalSalesVolume={totalRevenue} /></div>;
      case 'mxik':
        return <div className="p-4"><MxikImport /></div>;
      case 'reviews':
        return <div className="p-4"><MarketplaceReviews connectedMarketplaces={connectedMarketplaces} /></div>;
      case 'ads':
        return <div className="p-4"><MarketplaceAdsCampaigns connectedMarketplaces={connectedMarketplaces} /></div>;
      case 'sales':
        return <div className="p-4"><SalesDashboard connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'support':
        return <div className="p-4"><SupportChat /></div>;
      case 'stores':
        return <div className="p-4"><MultiStoreManager connectedMarketplaces={connectedMarketplaces} onStoreChange={() => refetch()} /></div>;
      case 'profile':
        return <div className="p-4"><ProfilePasswordSetup /></div>;
      case 'tutorials':
        return <div className="p-4"><TutorialVideos /></div>;
      case 'unit-economy':
        return <div className="p-4"><UnitEconomyDashboard connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'sellzen-studio':
        return <div className="p-4"><SellZenStudio /></div>;
      case 'trend-hunter':
        return <MobileTrendHunter />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden safe-area-bottom" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
      <MobileSellerCloudHeader connectedCount={connectedMarketplaces.length} onRefresh={refetch} isLoading={connectionsLoading} />
      {isMoreActive && (
        <div className="fixed left-0 right-0 z-40 flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-background/80 backdrop-blur-xl" style={{ top: 'calc(3rem + env(safe-area-inset-top, 0px))' }}>
          <button
            onClick={() => setMoreMenuOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-sm active:scale-95 transition-transform"
          >
            {(() => {
              const labels: Record<string, string> = {
                'financials': '💰 Moliya', 'cost-prices': '💲 Tannarx',
                'pricing': '🏷 Narxlar', 'abc-analysis': '📊 ABC-analiz',
                'reviews': '💬 Sharhlar', 'ads': '📢 Reklama',
                'stock-forecast': '📦 Zaxira', 'card-clone': '📋 Klonlash',
                'problems': '⚠️ Muammolar', 'mxik': '📄 MXIK baza',
                'reports': '📑 Hisobotlar', 'notifications': '🔔 Bildirishnoma', 'subscription': '💳 Obuna',
                'sales': '📊 Sotuvlar', 'support': '💬 Yordam', 'stores': '🏪 Do\'konlar',
                'tutorials': '📖 Qo\'llanma', 'profile': '👤 Profil',
                'trend-hunter': '🔥 Trend Hunter', 'sellzen-studio': '✨ SellZen AI',
                'unit-economy': '💵 Unit-econ',
              };
              return labels[activeTab] || activeTab;
            })()}
          </button>
          <button
            onClick={() => setMoreMenuOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            Boshqa →
          </button>
        </div>
      )}
      <main style={{ paddingTop: isMoreActive ? 'calc(5.5rem + env(safe-area-inset-top, 0px))' : 'calc(3rem + env(safe-area-inset-top, 0px))' }}>
        <PullToRefresh onRefresh={async () => { await refetch(); toast.success("Ma'lumotlar yangilandi"); }}>
        <Suspense fallback={<TabLoader />}>
          <div className="transition-none">
            <FeatureGate tabId={activeTab} onNavigateToSubscription={() => setActiveTab('subscription')}>
              {renderContent()}
            </FeatureGate>
          </div>
        </Suspense>
        </PullToRefresh>
      </main>
      <MobileSellerCloudNav activeTab={activeTab} onTabChange={setActiveTab} onMorePress={() => setMoreMenuOpen(true)} />
      <MobileMoreMenu
        open={moreMenuOpen}
        onOpenChange={setMoreMenuOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <BackgroundTasksPanel />
    </div>
  );
}