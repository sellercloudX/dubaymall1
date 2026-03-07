import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
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
import { toDisplayUzs } from '@/lib/currency';
import { toast } from 'sonner';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { 
  Loader2, Globe, Package, ShoppingCart, BarChart3, 
  Scan, AlertTriangle, RefreshCw, MessageCircle
} from 'lucide-react';
import { MarketplaceLogo, MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';
import { OnboardingWizard } from '@/components/sellercloud/OnboardingWizard';
import { SellerCloudSidebar, sellerMenuItems } from '@/components/sellercloud/SellerCloudSidebar';


// Lazy load heavy tab components
const MarketplaceOAuth = lazy(() => import('@/components/sellercloud/MarketplaceOAuth').then(m => ({ default: m.MarketplaceOAuth })));
const MarketplaceProducts = lazy(() => import('@/components/sellercloud/MarketplaceProducts').then(m => ({ default: m.MarketplaceProducts })));
const MarketplaceOrders = lazy(() => import('@/components/sellercloud/MarketplaceOrders').then(m => ({ default: m.MarketplaceOrders })));
const FBSOrderManager = lazy(() => import('@/components/sellercloud/FBSOrderManager').then(m => ({ default: m.FBSOrderManager })));
const MarketplaceAnalytics = lazy(() => import('@/components/sellercloud/MarketplaceAnalytics').then(m => ({ default: m.MarketplaceAnalytics })));
const InventorySync = lazy(() => import('@/components/sellercloud/InventorySync').then(m => ({ default: m.InventorySync })));
const PriceManager = lazy(() => import('@/components/sellercloud/PriceManager').then(m => ({ default: m.PriceManager })));
const NotificationCenter = lazy(() => import('@/components/sellercloud/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const ReportsExport = lazy(() => import('@/components/sellercloud/ReportsExport').then(m => ({ default: m.ReportsExport })));
const SubscriptionBilling = lazy(() => import('@/components/sellercloud/SubscriptionBilling').then(m => ({ default: m.SubscriptionBilling })));
const FinancialDashboard = lazy(() => import('@/components/sellercloud/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const ABCAnalysis = lazy(() => import('@/components/sellercloud/ABCAnalysis').then(m => ({ default: m.ABCAnalysis })));
const MinPriceProtection = lazy(() => import('@/components/sellercloud/MinPriceProtection').then(m => ({ default: m.MinPriceProtection })));
const CardCloner = lazy(() => import('@/components/sellercloud/CardCloner').then(m => ({ default: m.CardCloner })));
const ProblematicProducts = lazy(() => import('@/components/sellercloud/ProblematicProducts').then(m => ({ default: m.ProblematicProducts })));
const MxikImport = lazy(() => import('@/components/sellercloud/MxikImport').then(m => ({ default: m.MxikImport })));
const ProfitCalculator = lazy(() => import('@/components/sellercloud/ProfitCalculator').then(m => ({ default: m.ProfitCalculator })));
const CostPriceManager = lazy(() => import('@/components/sellercloud/CostPriceManager').then(m => ({ default: m.CostPriceManager })));
const AIScannerPro = lazy(() => import('@/components/seller/AIScannerPro').then(m => ({ default: m.AIScannerPro })));
const MarketplaceReviews = lazy(() => import('@/components/sellercloud/MarketplaceReviews').then(m => ({ default: m.MarketplaceReviews })));
const WBSellerAnalytics = lazy(() => import('@/components/sellercloud/WBSellerAnalytics').then(m => ({ default: m.WBSellerAnalytics })));
const WBAdsCampaigns = lazy(() => import('@/components/sellercloud/WBAdsCampaigns').then(m => ({ default: m.WBAdsCampaigns })));
const SupportChat = lazy(() => import('@/components/sellercloud/SupportChat').then(m => ({ default: m.SupportChat })));
const SalesDashboard = lazy(() => import('@/components/sellercloud/SalesDashboard').then(m => ({ default: m.SalesDashboard })));
const MultiStoreManager = lazy(() => import('@/components/sellercloud/MultiStoreManager').then(m => ({ default: m.MultiStoreManager })));
const CompetitorPriceMonitor = lazy(() => import('@/components/sellercloud/CompetitorPriceMonitor').then(m => ({ default: m.CompetitorPriceMonitor })));

const TabLoader = () => <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

// Page titles for the top bar
const pageTitles: Record<string, string> = {
  marketplaces: 'Marketplacelar',
  stores: 'Do\'konlar boshqaruvi',
  scanner: 'AI Scanner Pro',
  products: 'Mahsulotlar',
  orders: 'Buyurtmalar',
  sales: 'Sotuvlar hisoboti',
  analytics: 'Umumiy analitika',
  'wb-analytics': 'WB Analitika',
  financials: 'Moliyaviy dashboard',
  abc: 'ABC-analiz',
  'cost-prices': 'Tannarx boshqaruvi',
  calculator: 'Foyda kalkulyatori',
  inventory: 'Zaxira sinxronlash',
  pricing: 'Narx boshqaruvi',
  reviews: 'Sharhlar va savollar',
  ads: 'Reklama kampaniyalari',
  'min-price': 'Min narx himoyasi',
  clone: 'Karta klonlash',
  problems: 'Muammoli mahsulotlar',
  mxik: 'MXIK kodlar bazasi',
  subscription: 'Obuna va to\'lov',
  reports: 'Hisobotlar',
  notifications: 'Bildirishnomalar',
  competitor: 'Raqobat narx monitoring',
  support: 'Yordam markazi',
};

export default function SellerCloudX() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  useExchangeRate();
  
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'marketplaces';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };
  
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
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
  
  const connectedMarketplaces = useMemo(() => connections.map(c => c.marketplace), [connections]);
  const store = useMarketplaceDataStore(connectedMarketplaces);
  
  const totalRevenue = (() => {
    const orders = store.allOrders;
    if (orders.length === 0) return connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
    const orderMpMap = new Map<number, string>();
    connectedMarketplaces.forEach(mp => {
      store.getOrders(mp).forEach(o => orderMpMap.set(o.id, mp));
    });
    return orders
      .filter((o: any) => !['CANCELLED', 'CANCELED', 'RETURNED'].includes(String(o.status).toUpperCase()))
      .reduce((sum: number, o: any) => sum + toDisplayUzs(o.itemsTotal || o.total || 0, orderMpMap.get(o.id) || ''), 0);
  })();

  const handleMarketplaceConnect = async (marketplace: string) => {
    await refetch();
    toast.success(`${marketplace} ma'lumotlari yangilandi`);
  };

  useEffect(() => {
    if (isMobile && subscription) {
      navigate('/seller-cloud-mobile', { replace: true });
    }
  }, [isMobile, subscription, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/seller-cloud');
    }
  }, [user, authLoading, navigate]);
  
  const hasAccess = accessStatus?.is_active ?? false;

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
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <OnboardingWizard 
            onActivate={async () => {
              const result = await createSubscription('pro');
              if (result.success) {
                toast.success('Obuna yaratildi!');
              } else {
                toast.error(result.error || 'Xatolik yuz berdi');
              }
            }}
            onContactAdmin={() => {
              window.open('https://t.me/sellercloudx_support', '_blank');
            }}
          />
          <div className="text-center mt-6">
            <Button variant="ghost" asChild><Link to="/">← Bosh sahifaga qaytish</Link></Button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Render content based on active tab
  const renderContent = () => {
    // If no access, only show subscription & notifications
    if (!hasAccess) {
      if (activeTab === 'notifications') return <NotificationCenter />;
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
      case 'orders-old':
        return <MarketplaceOrders connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'analytics':
        return <MarketplaceAnalytics connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'wb-analytics':
        return <WBSellerAnalytics connectedMarketplaces={connectedMarketplaces} />;
      case 'financials':
        return <FinancialDashboard connectedMarketplaces={connectedMarketplaces} store={store} monthlyFee={subscription?.monthly_fee || 499} commissionPercent={subscription?.commission_percent || 4} />;
      case 'abc':
        return <ABCAnalysis connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} />;
      case 'cost-prices':
        return <CostPriceManager connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'calculator':
        return <ProfitCalculator commissionPercent={subscription?.commission_percent || 4} />;
      case 'competitor':
        return <CompetitorPriceMonitor connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'inventory':
        return <InventorySync connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'pricing':
        return <PriceManager connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'reviews':
        return <MarketplaceReviews connectedMarketplaces={connectedMarketplaces} />;
      case 'ads':
        return <WBAdsCampaigns connectedMarketplaces={connectedMarketplaces} />;
      case 'min-price':
        return <MinPriceProtection connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} />;
      case 'clone':
        return <CardCloner connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'problems':
        return <ProblematicProducts connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'mxik':
        return <MxikImport />;
      case 'subscription':
        return <SubscriptionBilling totalSalesVolume={totalRevenue} />;
      case 'reports':
        return <ReportsExport connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'notifications':
        return <NotificationCenter />;
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
              <Badge variant="secondary" className="text-xs">Pro</Badge>
            </div>
          </header>

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-card/40">
            <StatCard label="Ulangan marketplace" value={connectedMarketplaces.length} />
            <StatCard label="Jami mahsulotlar" value={store.totalProducts} />
            <StatCard label="Jami buyurtmalar" value={store.totalOrders} />
            <StatCard label="Jami daromad (so'm)" value={formatRevenue(totalRevenue)} highlight />
          </div>

          {/* Alerts */}
          {accessStatus && !accessStatus.is_active && (
            <div className="px-6 pt-4">
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-destructive text-sm">Akkount cheklangan</h4>
                      <p className="text-xs text-muted-foreground mt-1">{accessStatus.message}</p>
                      {totalDebt > 0 && <p className="font-medium text-sm mt-1">Qarzdorlik: {new Intl.NumberFormat('uz-UZ').format(totalDebt)} so'm</p>}
                    </div>
                    <Button variant="destructive" size="sm">To'lash</Button>
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
            <Suspense fallback={<TabLoader />}>
              {renderContent()}
            </Suspense>
          </main>
        </div>

        {/* Floating support chat button */}
        {activeTab !== 'support' && hasAccess && (
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
function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className={`text-lg lg:text-xl font-bold truncate ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
      <span className="text-[11px] lg:text-xs text-muted-foreground truncate">{label}</span>
    </div>
  );
}

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
