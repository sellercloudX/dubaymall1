import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useMarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Loader2, Globe, Package, ShoppingCart, BarChart3, 
  Scan, Crown, Check, ArrowRight, ArrowDownUp, DollarSign,
  Upload, Bell, FileSpreadsheet, CreditCard, Calculator, AlertTriangle,
  Shield, Copy, AlertOctagon, Wrench, RefreshCw, Sparkles
} from 'lucide-react';

// Lazy load heavy tab components
const MarketplaceOAuth = lazy(() => import('@/components/sellercloud/MarketplaceOAuth').then(m => ({ default: m.MarketplaceOAuth })));
const MarketplaceProducts = lazy(() => import('@/components/sellercloud/MarketplaceProducts').then(m => ({ default: m.MarketplaceProducts })));
const MarketplaceOrders = lazy(() => import('@/components/sellercloud/MarketplaceOrders').then(m => ({ default: m.MarketplaceOrders })));
const MarketplaceAnalytics = lazy(() => import('@/components/sellercloud/MarketplaceAnalytics').then(m => ({ default: m.MarketplaceAnalytics })));
const InventorySync = lazy(() => import('@/components/sellercloud/InventorySync').then(m => ({ default: m.InventorySync })));
const PriceManager = lazy(() => import('@/components/sellercloud/PriceManager').then(m => ({ default: m.PriceManager })));
const MultiPublish = lazy(() => import('@/components/sellercloud/MultiPublish').then(m => ({ default: m.MultiPublish })));
const NotificationCenter = lazy(() => import('@/components/sellercloud/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const ReportsExport = lazy(() => import('@/components/sellercloud/ReportsExport').then(m => ({ default: m.ReportsExport })));
const SubscriptionBilling = lazy(() => import('@/components/sellercloud/SubscriptionBilling').then(m => ({ default: m.SubscriptionBilling })));
const FinancialDashboard = lazy(() => import('@/components/sellercloud/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const ABCAnalysis = lazy(() => import('@/components/sellercloud/ABCAnalysis').then(m => ({ default: m.ABCAnalysis })));
const MinPriceProtection = lazy(() => import('@/components/sellercloud/MinPriceProtection').then(m => ({ default: m.MinPriceProtection })));
const CardCloner = lazy(() => import('@/components/sellercloud/CardCloner').then(m => ({ default: m.CardCloner })));
const ProblematicProducts = lazy(() => import('@/components/sellercloud/ProblematicProducts').then(m => ({ default: m.ProblematicProducts })));
const CardQualityAudit = lazy(() => import('@/components/sellercloud/CardQualityAudit').then(m => ({ default: m.CardQualityAudit })));
const ProfitCalculator = lazy(() => import('@/components/sellercloud/ProfitCalculator').then(m => ({ default: m.ProfitCalculator })));
const CostPriceManager = lazy(() => import('@/components/sellercloud/CostPriceManager').then(m => ({ default: m.CostPriceManager })));
const AIScannerPro = lazy(() => import('@/components/seller/AIScannerPro').then(m => ({ default: m.AIScannerPro })));

const TabLoader = () => <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

export default function SellerCloudX() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Persist active tab in URL hash so it survives re-renders and refreshes
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'marketplaces';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };
  
  // Listen for hash changes (e.g. back/forward)
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
   
   // Centralized data store — fetches once, cached for all tabs
   const store = useMarketplaceDataStore(connectedMarketplaces);
  
  // Calculate revenue from actual order data, excluding cancelled/returned
  const totalRevenue = (() => {
    const orders = store.allOrders;
    if (orders.length === 0) return connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
    return orders
      .filter((o: any) => !['CANCELLED', 'CANCELED', 'RETURNED'].includes(String(o.status).toUpperCase()))
      .reduce((sum: number, o: any) => sum + (o.itemsTotal || o.total || 0), 0);
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
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
                <Crown className="h-3 w-3 mr-1" />Premium
              </Badge>
              <h1 className="text-4xl font-bold mb-4">SellerCloudX</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Barcha marketplacelarni bitta joydan boshqaring. Uzum, Yandex, Wildberries, Ozon - hammasi bir dashboardda.
              </p>
            </div>
            <Card className="max-w-lg mx-auto border-2 border-primary/20 shadow-xl">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl">SellerCloudX Pro</CardTitle>
                <CardDescription>Marketplace avtomatizatsiya tizimi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="text-5xl font-bold text-primary">$499</div>
                  <div className="text-muted-foreground">/oyiga</div>
                </div>
                <ul className="space-y-3">
                  {["4 ta marketplace: Uzum, Yandex, Wildberries, Ozon","OAuth orqali bir tugmada ulash","AI bilan avtomatik kartochka yaratish","Barcha marketplacelar analitikasi","Buyurtmalarni markazlashtirilgan boshqarish","Zaxira sinxronizatsiyasi","Narxlarni avtomatik optimallashtirish","24/7 texnik yordam"].map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" /><span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" size="lg" onClick={async () => {
                  const result = await createSubscription('pro');
                  if (result.success) {
                    toast.success('Obuna so\'rovi yuborildi! Admin tasdiqlashini kuting.');
                  } else {
                    toast.error(result.error || 'Xatolik yuz berdi');
                  }
                }}>Obunani boshlash<ArrowRight className="ml-2 h-4 w-4" /></Button>
                <p className="text-xs text-center text-muted-foreground">7 kunlik bepul sinov davri. Istalgan vaqtda bekor qilish mumkin.</p>
              </CardContent>
            </Card>
            <div className="text-center mt-8">
              <Button variant="ghost" asChild><Link to="/">← Bosh sahifaga qaytish</Link></Button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">SellerCloudX<Badge variant="secondary" className="text-xs">Pro</Badge></h1>
              <p className="text-sm text-muted-foreground">Marketplace avtomatizatsiya markazi</p>
            </div>
          </div>
          <Button variant="outline" asChild><Link to="/">Bosh sahifa →</Link></Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{connectedMarketplaces.length}</div><div className="text-sm text-muted-foreground">Ulangan marketplace</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{store.totalProducts}</div><div className="text-sm text-muted-foreground">Jami mahsulotlar</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{store.totalOrders}</div><div className="text-sm text-muted-foreground">Jami buyurtmalar</div></CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">
              {(() => { const r = totalRevenue; return r >= 1000000 ? (r/1000000).toFixed(1)+' mln' : new Intl.NumberFormat('uz-UZ').format(r); })()}
            </div>
            <div className="text-sm text-muted-foreground">Jami daromad (so'm)</div>
          </CardContent></Card>
        </div>

        {accessStatus && !accessStatus.is_active && (
          <Card className="border-destructive bg-destructive/5 mb-6"><CardContent className="pt-6">
            <div className="flex items-start gap-4"><AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive">Akkount cheklangan</h4>
                <p className="text-sm text-muted-foreground mt-1">{accessStatus.message}</p>
                {totalDebt > 0 && <p className="font-medium mt-2">Qarzdorlik: {new Intl.NumberFormat('uz-UZ').format(totalDebt)} so'm</p>}
                <p className="text-xs text-muted-foreground mt-2">To'lov qiling — avtomatik aktivlashadi. Yoki admin bilan bog'laning.</p>
              </div>
              <Button variant="destructive" size="sm">To'lash</Button>
            </div>
          </CardContent></Card>
        )}

        {store.hasError && (
          <Card className="border-destructive/50 bg-destructive/5 mb-6"><CardContent className="pt-6">
            <div className="flex items-start gap-4"><AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1"><h4 className="font-semibold text-destructive text-sm">Ma'lumot yuklashda xatolik</h4>
                <p className="text-xs text-muted-foreground mt-1">Ba'zi marketplace ma'lumotlari yuklanmadi. Qayta urinib ko'ring.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching}>
                <RefreshCw className={`h-4 w-4 ${store.isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent></Card>
        )}

        {!hasAccess ? (
          // When access is restricted, only show subscription tab
          <Tabs defaultValue="subscription" className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="subscription" className="gap-2"><CreditCard className="h-4 w-4" /><span className="hidden sm:inline">Obuna</span></TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /><span className="hidden sm:inline">Bildirishnoma</span></TabsTrigger>
            </TabsList>
            <TabsContent value="subscription"><Suspense fallback={<TabLoader />}><SubscriptionBilling totalSalesVolume={totalRevenue} /></Suspense></TabsContent>
            <TabsContent value="notifications"><Suspense fallback={<TabLoader />}><NotificationCenter /></Suspense></TabsContent>
          </Tabs>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            {/* Primary navigation - main sections */}
            <TabsList className="flex flex-wrap h-auto gap-1.5 p-1.5 w-full">
              <TabsTrigger value="marketplaces" className="gap-1.5 text-xs sm:text-sm"><Globe className="h-4 w-4 shrink-0" /><span className="hidden md:inline">Marketplacelar</span></TabsTrigger>
              <TabsTrigger value="scanner" className="gap-1.5 text-xs sm:text-sm"><Scan className="h-4 w-4 shrink-0" /><span className="hidden md:inline">AI Scanner</span></TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5 text-xs sm:text-sm"><Package className="h-4 w-4 shrink-0" /><span className="hidden md:inline">Mahsulotlar</span></TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5 text-xs sm:text-sm"><ShoppingCart className="h-4 w-4 shrink-0" /><span className="hidden md:inline">Buyurtmalar</span></TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 text-xs sm:text-sm"><BarChart3 className="h-4 w-4 shrink-0" /><span className="hidden md:inline">Analitika</span></TabsTrigger>
              <TabsTrigger value="tools" className="gap-1.5 text-xs sm:text-sm"><Wrench className="h-4 w-4 shrink-0" /><span className="hidden md:inline">Asboblar</span></TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm"><CreditCard className="h-4 w-4 shrink-0" /><span className="hidden md:inline">Sozlamalar</span></TabsTrigger>
            </TabsList>

            <TabsContent value="marketplaces">
              <Suspense fallback={<TabLoader />}>
                <MarketplaceOAuth connections={connections} isLoading={connectionsLoading} connectMarketplace={connectMarketplace} disconnectMarketplace={disconnectMarketplace} syncMarketplace={syncMarketplace} onConnect={handleMarketplaceConnect} store={store} />
              </Suspense>
            </TabsContent>
            <TabsContent value="scanner">
              <Suspense fallback={<TabLoader />}>
                {connectedMarketplaces.length > 0 ? <AIScannerPro shopId="sellercloud" /> : (
                  <Card><CardContent className="py-12 text-center"><Scan className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">AI Scanner Pro</h3><p className="text-muted-foreground mb-4">Avval kamida bitta marketplace ulang</p></CardContent></Card>
                )}
              </Suspense>
            </TabsContent>
            <TabsContent value="products"><Suspense fallback={<TabLoader />}><MarketplaceProducts connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
            <TabsContent value="orders"><Suspense fallback={<TabLoader />}><MarketplaceOrders connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
            
            {/* Analytics - sub-tabs */}
            <TabsContent value="analytics">
              <Suspense fallback={<TabLoader />}>
                <AnalyticsSubTabs connectedMarketplaces={connectedMarketplaces} store={store} subscription={subscription} totalRevenue={totalRevenue} />
              </Suspense>
            </TabsContent>

            {/* Tools - sub-tabs */}
            <TabsContent value="tools">
              <Suspense fallback={<TabLoader />}>
                <ToolsSubTabs connectedMarketplaces={connectedMarketplaces} store={store} subscription={subscription} />
              </Suspense>
            </TabsContent>

            {/* Settings - sub-tabs */}
            <TabsContent value="settings">
              <Suspense fallback={<TabLoader />}>
                <SettingsSubTabs totalRevenue={totalRevenue} connectedMarketplaces={connectedMarketplaces} store={store} />
              </Suspense>
            </TabsContent>
          </Tabs>
        )}
      </div>
      <Footer />
    </>
  );
}

// Sub-tab components for grouped navigation
function AnalyticsSubTabs({ connectedMarketplaces, store, subscription, totalRevenue }: { 
  connectedMarketplaces: string[]; store: any; subscription: any; totalRevenue: number;
}) {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="h-auto gap-1 p-1">
        <TabsTrigger value="overview" className="text-xs gap-1"><BarChart3 className="h-3.5 w-3.5" />Umumiy</TabsTrigger>
        <TabsTrigger value="financials" className="text-xs gap-1"><Calculator className="h-3.5 w-3.5" />Moliya</TabsTrigger>
        <TabsTrigger value="abc" className="text-xs gap-1"><BarChart3 className="h-3.5 w-3.5" />ABC-analiz</TabsTrigger>
        <TabsTrigger value="cost-prices" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Tannarx</TabsTrigger>
        <TabsTrigger value="calculator" className="text-xs gap-1"><Calculator className="h-3.5 w-3.5" />Kalkulyator</TabsTrigger>
      </TabsList>
      <TabsContent value="overview"><Suspense fallback={<TabLoader />}><MarketplaceAnalytics connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
      <TabsContent value="financials"><Suspense fallback={<TabLoader />}><FinancialDashboard connectedMarketplaces={connectedMarketplaces} store={store} monthlyFee={subscription?.monthly_fee || 499} commissionPercent={subscription?.commission_percent || 4} /></Suspense></TabsContent>
      <TabsContent value="abc"><Suspense fallback={<TabLoader />}><ABCAnalysis connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></Suspense></TabsContent>
      <TabsContent value="cost-prices"><Suspense fallback={<TabLoader />}><CostPriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
      <TabsContent value="calculator"><Suspense fallback={<TabLoader />}><ProfitCalculator commissionPercent={subscription?.commission_percent || 4} /></Suspense></TabsContent>
    </Tabs>
  );
}

function ToolsSubTabs({ connectedMarketplaces, store, subscription }: { 
  connectedMarketplaces: string[]; store: any; subscription: any;
}) {
  return (
    <Tabs defaultValue="audit" className="space-y-4">
      <TabsList className="h-auto gap-1 p-1">
        <TabsTrigger value="audit" className="text-xs gap-1"><Sparkles className="h-3.5 w-3.5" />Sifat auditi</TabsTrigger>
        <TabsTrigger value="inventory" className="text-xs gap-1"><ArrowDownUp className="h-3.5 w-3.5" />Zaxira</TabsTrigger>
        <TabsTrigger value="pricing" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Narxlar</TabsTrigger>
        <TabsTrigger value="publish" className="text-xs gap-1"><Upload className="h-3.5 w-3.5" />Joylash</TabsTrigger>
        <TabsTrigger value="min-price" className="text-xs gap-1"><Shield className="h-3.5 w-3.5" />Min narx</TabsTrigger>
        <TabsTrigger value="clone" className="text-xs gap-1"><Copy className="h-3.5 w-3.5" />Klonlash</TabsTrigger>
        <TabsTrigger value="problems" className="text-xs gap-1"><AlertOctagon className="h-3.5 w-3.5" />Muammolar</TabsTrigger>
      </TabsList>
      <TabsContent value="audit"><Suspense fallback={<TabLoader />}><CardQualityAudit connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
      <TabsContent value="inventory"><Suspense fallback={<TabLoader />}><InventorySync connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
      <TabsContent value="pricing"><Suspense fallback={<TabLoader />}><PriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
      <TabsContent value="publish"><Suspense fallback={<TabLoader />}><MultiPublish connectedMarketplaces={connectedMarketplaces} /></Suspense></TabsContent>
      <TabsContent value="min-price"><Suspense fallback={<TabLoader />}><MinPriceProtection connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></Suspense></TabsContent>
      <TabsContent value="clone"><Suspense fallback={<TabLoader />}><CardCloner connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
      <TabsContent value="problems"><Suspense fallback={<TabLoader />}><ProblematicProducts connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
    </Tabs>
  );
}

function SettingsSubTabs({ totalRevenue, connectedMarketplaces, store }: { 
  totalRevenue: number; connectedMarketplaces: string[]; store: any;
}) {
  return (
    <Tabs defaultValue="subscription" className="space-y-4">
      <TabsList className="h-auto gap-1 p-1">
        <TabsTrigger value="subscription" className="text-xs gap-1"><CreditCard className="h-3.5 w-3.5" />Obuna</TabsTrigger>
        <TabsTrigger value="reports" className="text-xs gap-1"><FileSpreadsheet className="h-3.5 w-3.5" />Hisobotlar</TabsTrigger>
        <TabsTrigger value="notifications" className="text-xs gap-1"><Bell className="h-3.5 w-3.5" />Bildirishnoma</TabsTrigger>
      </TabsList>
      <TabsContent value="subscription"><Suspense fallback={<TabLoader />}><SubscriptionBilling totalSalesVolume={totalRevenue} /></Suspense></TabsContent>
      <TabsContent value="reports"><Suspense fallback={<TabLoader />}><ReportsExport connectedMarketplaces={connectedMarketplaces} store={store} /></Suspense></TabsContent>
      <TabsContent value="notifications"><Suspense fallback={<TabLoader />}><NotificationCenter /></Suspense></TabsContent>
    </Tabs>
  );
}
