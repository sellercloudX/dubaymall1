import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useMarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { toDisplayUzs } from '@/lib/currency';
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
import { OnboardingWizard } from '@/components/sellercloud/OnboardingWizard';

// Lazy load ALL tab content components for instant tab switching
const MobileAnalytics = lazy(() => import('@/components/mobile/MobileAnalytics').then(m => ({ default: m.MobileAnalytics })));
const MobileProducts = lazy(() => import('@/components/mobile/MobileProducts').then(m => ({ default: m.MobileProducts })));
const MobileOrders = lazy(() => import('@/components/mobile/MobileOrders').then(m => ({ default: m.MobileOrders })));
const AIScannerPro = lazy(() => import('@/components/seller/AIScannerPro').then(m => ({ default: m.AIScannerPro })));
const MarketplaceOAuth = lazy(() => import('@/components/sellercloud/MarketplaceOAuth').then(m => ({ default: m.MarketplaceOAuth })));
const ABCAnalysis = lazy(() => import('@/components/sellercloud/ABCAnalysis').then(m => ({ default: m.ABCAnalysis })));
const MinPriceProtection = lazy(() => import('@/components/sellercloud/MinPriceProtection').then(m => ({ default: m.MinPriceProtection })));
const CardCloner = lazy(() => import('@/components/sellercloud/CardCloner').then(m => ({ default: m.CardCloner })));
const ProblematicProducts = lazy(() => import('@/components/sellercloud/ProblematicProducts').then(m => ({ default: m.ProblematicProducts })));
const FinancialDashboard = lazy(() => import('@/components/sellercloud/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const ProfitCalculator = lazy(() => import('@/components/sellercloud/ProfitCalculator').then(m => ({ default: m.ProfitCalculator })));
const InventorySync = lazy(() => import('@/components/sellercloud/InventorySync').then(m => ({ default: m.InventorySync })));
const PriceManager = lazy(() => import('@/components/sellercloud/PriceManager').then(m => ({ default: m.PriceManager })));

const ReportsExport = lazy(() => import('@/components/sellercloud/ReportsExport').then(m => ({ default: m.ReportsExport })));
const NotificationCenter = lazy(() => import('@/components/sellercloud/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const SubscriptionBilling = lazy(() => import('@/components/sellercloud/SubscriptionBilling').then(m => ({ default: m.SubscriptionBilling })));
const CostPriceManager = lazy(() => import('@/components/sellercloud/CostPriceManager').then(m => ({ default: m.CostPriceManager })));
const UzumCardHelper = lazy(() => import('@/components/sellercloud/UzumCardHelper').then(m => ({ default: m.UzumCardHelper })));
const MxikImport = lazy(() => import('@/components/sellercloud/MxikImport').then(m => ({ default: m.MxikImport })));
const MarketplaceReviews = lazy(() => import('@/components/sellercloud/MarketplaceReviews').then(m => ({ default: m.MarketplaceReviews })));
const WBSellerAnalytics = lazy(() => import('@/components/sellercloud/WBSellerAnalytics').then(m => ({ default: m.WBSellerAnalytics })));
const WBAdsCampaigns = lazy(() => import('@/components/sellercloud/WBAdsCampaigns').then(m => ({ default: m.WBAdsCampaigns })));

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
  const [showPaymentBypass, setShowPaymentBypass] = useState(false);
  
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
   
   // Calculate revenue from actual order data with proper currency conversion
   const totalRevenue = useMemo(() => {
     const orders = store.allOrders;
     if (orders.length === 0) return connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
     // Build order→marketplace map
     const orderMpMap = new Map<number, string>();
     connectedMarketplaces.forEach(mp => {
       store.getOrders(mp).forEach(o => orderMpMap.set(o.id, mp));
     });
     return orders
       .filter((o: any) => !['CANCELLED', 'CANCELED', 'RETURNED'].includes(String(o.status).toUpperCase()))
       .reduce((sum: number, o: any) => sum + toDisplayUzs(o.itemsTotal || o.total || 0, orderMpMap.get(o.id) || ''), 0);
   }, [store.allOrders, connections, connectedMarketplaces]);

  const handleMarketplaceConnect = async () => {
    await refetch();
    toast.success('Marketplace ma\'lumotlari yangilandi');
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/seller-cloud-mobile');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20 overflow-y-auto">
        <OnboardingWizard 
          onActivate={async () => {
            const result = await createSubscription('pro');
            if (result.success) {
              toast.success('Obuna yaratildi! To\'lov sahifasiga o\'tyapsiz...');
            } else {
              toast.error(result.error || 'Xatolik yuz berdi');
            }
          }}
          onContactAdmin={() => {
            window.open('https://t.me/sellercloudx_support', '_blank');
          }}
          onGoHome={() => navigate('/')}
        />
      </div>
    );
  }

  if (accessStatus && !accessStatus.is_active && !showPaymentBypass) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20 overflow-y-auto">
        <OnboardingWizard 
          onActivate={async () => {
            setShowPaymentBypass(true);
            setActiveTab('subscription' as any);
          }}
          onContactAdmin={() => {
            window.open('https://t.me/sellercloudx_support', '_blank');
          }}
          onGoHome={() => navigate('/')}
        />
      </div>
    );
  }

  const isMoreActive = !primaryTabIds.includes(activeTab);

  const renderContent = () => {
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
        return <div className="p-4"><AIScannerPro shopId="sellercloud" /></div>;
      case 'products':
        return <MobileProducts connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'orders':
        return <MobileOrders connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'abc-analysis':
        return <div className="p-4"><ABCAnalysis connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'cost-prices':
        return <div className="p-4"><CostPriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'min-price':
        return <div className="p-4"><MinPriceProtection connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'card-clone':
        return <div className="p-4"><CardCloner connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'uzum-card':
        return <div className="p-4"><UzumCardHelper connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'problems':
        return <div className="p-4"><ProblematicProducts connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'financials':
        return <div className="p-4"><FinancialDashboard connectedMarketplaces={connectedMarketplaces} store={store} monthlyFee={subscription?.monthly_fee || 499} commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'calculator':
        return <div className="p-4"><ProfitCalculator commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'inventory':
        return <div className="p-4"><InventorySync connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'pricing':
        return <div className="p-4"><PriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
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
      case 'seller-analytics':
        return <div className="p-4"><WBSellerAnalytics connectedMarketplaces={connectedMarketplaces} /></div>;
      case 'ads':
        return <div className="p-4"><WBAdsCampaigns connectedMarketplaces={connectedMarketplaces} /></div>;
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
                'financials': '💰 Moliya', 'calculator': '🧮 Kalkulyator', 'cost-prices': '💲 Tannarx',
                'pricing': '🏷 Narxlar', 'abc-analysis': '📊 ABC-analiz', 'seller-analytics': '📈 WB Analitika',
                'reviews': '💬 Sharhlar', 'ads': '📢 Reklama', 'inventory': '📦 Qoldiq',
                'min-price': '🛡 Min narx', 'card-clone': '📋 Klonlash', 'uzum-card': '✨ Uzum Card',
                'problems': '⚠️ Muammolar', 'mxik': '📄 MXIK baza', 'reports': '📑 Hisobotlar',
                'notifications': '🔔 Bildirishnoma', 'subscription': '💳 Obuna',
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
            {renderContent()}
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