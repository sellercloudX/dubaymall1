import { useEffect, useState } from 'react';
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
import { MarketplaceOAuth } from '@/components/sellercloud/MarketplaceOAuth';
import { MarketplaceProducts } from '@/components/sellercloud/MarketplaceProducts';
import { MarketplaceOrders } from '@/components/sellercloud/MarketplaceOrders';
import { MarketplaceAnalytics } from '@/components/sellercloud/MarketplaceAnalytics';
import { InventorySync } from '@/components/sellercloud/InventorySync';
import { PriceManager } from '@/components/sellercloud/PriceManager';
import { MultiPublish } from '@/components/sellercloud/MultiPublish';
import { NotificationCenter } from '@/components/sellercloud/NotificationCenter';
import { ReportsExport } from '@/components/sellercloud/ReportsExport';
import { SubscriptionBilling } from '@/components/sellercloud/SubscriptionBilling';
import { FinancialDashboard } from '@/components/sellercloud/FinancialDashboard';
import { ABCAnalysis } from '@/components/sellercloud/ABCAnalysis';
import { MinPriceProtection } from '@/components/sellercloud/MinPriceProtection';
import { CardCloner } from '@/components/sellercloud/CardCloner';
import { ProblematicProducts } from '@/components/sellercloud/ProblematicProducts';
import { ProfitCalculator } from '@/components/sellercloud/ProfitCalculator';
import { CostPriceManager } from '@/components/sellercloud/CostPriceManager';
import { AIScannerPro } from '@/components/seller/AIScannerPro';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useMarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { toast } from 'sonner';
import { 
  Loader2, Globe, Package, ShoppingCart, BarChart3, 
  Scan, Crown, Check, ArrowRight, ArrowDownUp, DollarSign,
  Upload, Bell, FileSpreadsheet, CreditCard, Calculator, AlertTriangle,
  Shield, Copy, AlertOctagon, Wrench, RefreshCw
} from 'lucide-react';

export default function SellerCloudX() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { 
    connections, 
    isLoading: connectionsLoading, 
    connectMarketplace,
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
  
   const connectedMarketplaces = connections.map(c => c.marketplace);
   
   // Centralized data store — fetches once, cached for all tabs
   const store = useMarketplaceDataStore(connectedMarketplaces);
  
  const totalRevenue = connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);

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
              <Button variant="ghost" asChild><Link to="/seller">← Dubay Mall do'koniga qaytish</Link></Button>
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
          <Button variant="outline" asChild><Link to="/seller">Dubay Mall do'koni →</Link></Button>
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
              <div className="flex-1"><h4 className="font-semibold text-destructive">Akkount cheklangan</h4><p className="text-sm text-muted-foreground mt-1">{accessStatus.message}</p>
                {totalDebt > 0 && <p className="font-medium mt-2">Qarzdorlik: {new Intl.NumberFormat('uz-UZ').format(totalDebt)} so'm</p>}
              </div><Button variant="destructive" size="sm">To'lash</Button>
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
            <TabsContent value="subscription"><SubscriptionBilling totalSalesVolume={totalRevenue} /></TabsContent>
            <TabsContent value="notifications"><NotificationCenter /></TabsContent>
          </Tabs>
        ) : (
          <Tabs defaultValue="marketplaces" className="space-y-6">
            {/* Primary navigation - main sections */}
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="marketplaces" className="gap-1.5"><Globe className="h-4 w-4" /><span className="hidden sm:inline">Marketplacelar</span></TabsTrigger>
              <TabsTrigger value="scanner" className="gap-1.5"><Scan className="h-4 w-4" /><span className="hidden sm:inline">AI Scanner</span></TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5"><Package className="h-4 w-4" /><span className="hidden sm:inline">Mahsulotlar</span></TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5"><ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">Buyurtmalar</span></TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Analitika</span></TabsTrigger>
              <TabsTrigger value="tools" className="gap-1.5"><Wrench className="h-4 w-4" /><span className="hidden sm:inline">Asboblar</span></TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5"><CreditCard className="h-4 w-4" /><span className="hidden sm:inline">Sozlamalar</span></TabsTrigger>
            </TabsList>

            <TabsContent value="marketplaces">
              <MarketplaceOAuth connections={connections} isLoading={connectionsLoading} connectMarketplace={connectMarketplace} syncMarketplace={syncMarketplace} onConnect={handleMarketplaceConnect} store={store} />
            </TabsContent>
            <TabsContent value="scanner">
              {connectedMarketplaces.length > 0 ? <AIScannerPro shopId="sellercloud" /> : (
                <Card><CardContent className="py-12 text-center"><Scan className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">AI Scanner Pro</h3><p className="text-muted-foreground mb-4">Avval kamida bitta marketplace ulang</p></CardContent></Card>
              )}
            </TabsContent>
            <TabsContent value="products"><MarketplaceProducts connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
            <TabsContent value="orders"><MarketplaceOrders connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
            
            {/* Analytics - sub-tabs */}
            <TabsContent value="analytics">
              <AnalyticsSubTabs connectedMarketplaces={connectedMarketplaces} store={store} subscription={subscription} totalRevenue={totalRevenue} />
            </TabsContent>

            {/* Tools - sub-tabs */}
            <TabsContent value="tools">
              <ToolsSubTabs connectedMarketplaces={connectedMarketplaces} store={store} subscription={subscription} />
            </TabsContent>

            {/* Settings - sub-tabs */}
            <TabsContent value="settings">
              <SettingsSubTabs totalRevenue={totalRevenue} connectedMarketplaces={connectedMarketplaces} store={store} />
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
      <TabsContent value="overview"><MarketplaceAnalytics connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
      <TabsContent value="financials"><FinancialDashboard connectedMarketplaces={connectedMarketplaces} store={store} monthlyFee={subscription?.monthly_fee || 499} commissionPercent={subscription?.commission_percent || 4} /></TabsContent>
      <TabsContent value="abc"><ABCAnalysis connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></TabsContent>
      <TabsContent value="cost-prices"><CostPriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
      <TabsContent value="calculator"><ProfitCalculator commissionPercent={subscription?.commission_percent || 4} /></TabsContent>
    </Tabs>
  );
}

function ToolsSubTabs({ connectedMarketplaces, store, subscription }: { 
  connectedMarketplaces: string[]; store: any; subscription: any;
}) {
  return (
    <Tabs defaultValue="inventory" className="space-y-4">
      <TabsList className="h-auto gap-1 p-1">
        <TabsTrigger value="inventory" className="text-xs gap-1"><ArrowDownUp className="h-3.5 w-3.5" />Zaxira</TabsTrigger>
        <TabsTrigger value="pricing" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Narxlar</TabsTrigger>
        <TabsTrigger value="publish" className="text-xs gap-1"><Upload className="h-3.5 w-3.5" />Joylash</TabsTrigger>
        <TabsTrigger value="min-price" className="text-xs gap-1"><Shield className="h-3.5 w-3.5" />Min narx</TabsTrigger>
        <TabsTrigger value="clone" className="text-xs gap-1"><Copy className="h-3.5 w-3.5" />Klonlash</TabsTrigger>
        <TabsTrigger value="problems" className="text-xs gap-1"><AlertOctagon className="h-3.5 w-3.5" />Muammolar</TabsTrigger>
      </TabsList>
      <TabsContent value="inventory"><InventorySync connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
      <TabsContent value="pricing"><PriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
      <TabsContent value="publish"><MultiPublish connectedMarketplaces={connectedMarketplaces} /></TabsContent>
      <TabsContent value="min-price"><MinPriceProtection connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></TabsContent>
      <TabsContent value="clone"><CardCloner connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
      <TabsContent value="problems"><ProblematicProducts connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
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
      <TabsContent value="subscription"><SubscriptionBilling totalSalesVolume={totalRevenue} /></TabsContent>
      <TabsContent value="reports"><ReportsExport connectedMarketplaces={connectedMarketplaces} store={store} /></TabsContent>
      <TabsContent value="notifications"><NotificationCenter /></TabsContent>
    </Tabs>
  );
}
