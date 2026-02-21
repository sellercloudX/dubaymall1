import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useMarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { MobileSellerCloudNav, type MobileTabType } from '@/components/mobile/MobileSellerCloudNav';
import { MobileSellerCloudHeader } from '@/components/mobile/MobileSellerCloudHeader';
import { BackgroundTasksPanel } from '@/components/mobile/BackgroundTasksPanel';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

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
const CardQualityAudit = lazy(() => import('@/components/sellercloud/CardQualityAudit').then(m => ({ default: m.CardQualityAudit })));
const ReportsExport = lazy(() => import('@/components/sellercloud/ReportsExport').then(m => ({ default: m.ReportsExport })));
const NotificationCenter = lazy(() => import('@/components/sellercloud/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const SubscriptionBilling = lazy(() => import('@/components/sellercloud/SubscriptionBilling').then(m => ({ default: m.SubscriptionBilling })));
const CostPriceManager = lazy(() => import('@/components/sellercloud/CostPriceManager').then(m => ({ default: m.CostPriceManager })));
const UzumCardHelper = lazy(() => import('@/components/sellercloud/UzumCardHelper').then(m => ({ default: m.UzumCardHelper })));

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

// Icons for more sub-tabs (imported inline to avoid heavy lucide bundle at top)
import { TrendingUp, Calculator, DollarSign, BarChart3, Shield, Copy, AlertOctagon, ArrowDownUp, Tag, Upload, FileSpreadsheet, Bell, CreditCard, Coins, Sparkles } from 'lucide-react';

const moreSubTabs = [
  { id: 'quality-audit' as const, icon: Sparkles, label: 'Sifat auditi' },
  { id: 'inventory' as const, icon: ArrowDownUp, label: 'Qoldiq' },
  { id: 'financials' as const, icon: DollarSign, label: 'Moliya' },
  { id: 'calculator' as const, icon: Calculator, label: 'Kalkulyator' },
  { id: 'abc-analysis' as const, icon: BarChart3, label: 'ABC-analiz' },
  { id: 'cost-prices' as const, icon: Coins, label: 'Tannarx' },
  { id: 'min-price' as const, icon: Shield, label: 'Min narx' },
  { id: 'card-clone' as const, icon: Copy, label: 'Klonlash' },
  { id: 'uzum-card' as const, icon: Sparkles, label: 'Uzum Card' },
  { id: 'problems' as const, icon: AlertOctagon, label: 'Muammolar' },
  { id: 'pricing' as const, icon: Tag, label: 'Narxlar' },
  { id: 'reports' as const, icon: FileSpreadsheet, label: 'Hisobotlar' },
  { id: 'notifications' as const, icon: Bell, label: 'Bildirishnoma' },
  { id: 'subscription' as const, icon: CreditCard, label: 'Obuna' },
];

const primaryTabIds: MobileTabType[] = ['marketplaces', 'analytics', 'scanner', 'products', 'orders'];

export default function SellerCloudMobile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTabRaw] = useState<MobileTabType>('analytics');
  
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
  
   const connectedMarketplaces = connections.map(c => c.marketplace);
   const totalRevenue = connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
   
   // Centralized data store — fetches once, cached for all tabs
   const store = useMarketplaceDataStore(connectedMarketplaces);

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">SellerCloudX Pro</h1>
        <p className="text-muted-foreground text-center mb-6">Barcha marketplacelarni bitta joydan boshqaring</p>
        <Button size="lg" onClick={async () => {
          const result = await createSubscription('pro');
          if (result.success) {
            toast.success('Obuna so\'rovi yuborildi! Admin tasdiqlashini kuting.');
          } else {
            toast.error(result.error || 'Xatolik yuz berdi');
          }
        }}>Obuna bo'lish</Button>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/')}>Bosh sahifaga qaytish</Button>
      </div>
    );
  }

  if (accessStatus && !accessStatus.is_active) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="border-destructive max-w-sm w-full"><CardContent className="pt-6 text-center space-y-4">
          <Lock className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Akkount cheklangan</h2>
          <p className="text-sm text-muted-foreground">{accessStatus.message}</p>
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">Nima qilish kerak?</p>
            <ul className="text-xs text-muted-foreground space-y-1 text-left">
              <li>1. To'lov qiling — avtomatik aktivlashadi</li>
              <li>2. Yoki admin bilan bog'laning: <a href="https://t.me/sellercloudx_support" target="_blank" className="text-primary underline">@sellercloudx_support</a></li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" onClick={() => setActiveTab('subscription' as any)}>To'lov qilish</Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>Bosh sahifa</Button>
          </div>
        </CardContent></Card>
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
      case 'quality-audit':
        return <div className="p-4"><CardQualityAudit connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'pricing':
        return <div className="p-4"><PriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'reports':
        return <div className="p-4"><ReportsExport connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'notifications':
        return <div className="p-4"><NotificationCenter /></div>;
      case 'subscription':
        return <div className="p-4"><SubscriptionBilling totalSalesVolume={totalRevenue} /></div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32 overflow-x-hidden safe-area-bottom">
      <MobileSellerCloudHeader connectedCount={connectedMarketplaces.length} onRefresh={refetch} isLoading={connectionsLoading} />
      {isMoreActive && (
        <div className="fixed left-0 right-0 z-40 flex gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar border-b bg-background/95 backdrop-blur-sm" style={{ top: 'calc(3rem + env(safe-area-inset-top, 0px))' }}>
          {moreSubTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn("flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-150 min-h-[30px]",
                  isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80 active:scale-95")}>
                <Icon className="h-3.5 w-3.5 shrink-0" />{tab.label}
              </button>
            );
          })}
        </div>
      )}
      <main style={{ paddingTop: isMoreActive ? 'calc(5rem + env(safe-area-inset-top, 0px))' : 'calc(3rem + env(safe-area-inset-top, 0px))' }}>
        <PullToRefresh onRefresh={async () => { await refetch(); toast.success("Ma'lumotlar yangilandi"); }}>
        <Suspense fallback={<TabLoader />}>
          <div className="transition-none">
            {renderContent()}
          </div>
        </Suspense>
        </PullToRefresh>
      </main>
      <MobileSellerCloudNav activeTab={activeTab} onTabChange={setActiveTab} />
      <BackgroundTasksPanel />
    </div>
  );
}