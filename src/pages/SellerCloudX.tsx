import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarketplaceOAuth } from '@/components/sellercloud/MarketplaceOAuth';
import { MarketplaceProducts } from '@/components/sellercloud/MarketplaceProducts';
import { MarketplaceOrders } from '@/components/sellercloud/MarketplaceOrders';
import { MarketplaceAnalytics } from '@/components/sellercloud/MarketplaceAnalytics';
import { InventorySync } from '@/components/sellercloud/InventorySync';
import { PriceManager } from '@/components/sellercloud/PriceManager';
import { MultiPublish } from '@/components/sellercloud/MultiPublish';
import { NotificationCenter } from '@/components/sellercloud/NotificationCenter';
import { ReportsExport } from '@/components/sellercloud/ReportsExport';
import { AIScannerPro } from '@/components/seller/AIScannerPro';
import { toast } from 'sonner';
import { 
  Loader2, Globe, Package, ShoppingCart, BarChart3, 
  Scan, Crown, Check, ArrowRight, ArrowDownUp, DollarSign,
  Upload, Bell, FileSpreadsheet
} from 'lucide-react';

export default function SellerCloudX() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [hasSubscription, setHasSubscription] = useState(false);
  const [connectedMarketplaces, setConnectedMarketplaces] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/seller-cloud');
    }
  }, [user, authLoading, navigate]);

  // Mock subscription check - replace with real check
  useEffect(() => {
    // TODO: Check if user has SellerCloudX subscription
    setHasSubscription(true); // For demo
  }, [user]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Show pricing if no subscription
  if (!hasSubscription) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Hero */}
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
              <h1 className="text-4xl font-bold mb-4">SellerCloudX</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Barcha marketplacelarni bitta joydan boshqaring. Uzum, Yandex, Wildberries, Ozon - hammasi bir dashboardda.
              </p>
            </div>

            {/* Pricing Card */}
            <Card className="max-w-lg mx-auto border-2 border-primary/20 shadow-xl">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
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
                  {[
                    "4 ta marketplace: Uzum, Yandex, Wildberries, Ozon",
                    "OAuth orqali bir tugmada ulash",
                    "AI bilan avtomatik kartochka yaratish",
                    "Barcha marketplacelar analitikasi",
                    "Buyurtmalarni markazlashtirilgan boshqarish",
                    "Zaxira sinxronizatsiyasi",
                    "Narxlarni avtomatik optimallashtirish",
                    "24/7 texnik yordam",
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button className="w-full" size="lg">
                  Obunani boshlash
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  7 kunlik bepul sinov davri. Istalgan vaqtda bekor qilish mumkin.
                </p>
              </CardContent>
            </Card>

            {/* Back link */}
            <div className="text-center mt-8">
              <Button variant="ghost" asChild>
                <Link to="/seller">
                  ← BazarHub do'koniga qaytish
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                SellerCloudX
                <Badge variant="secondary" className="text-xs">Pro</Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Marketplace avtomatizatsiya markazi
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link to="/seller">
              BazarHub do'koni →
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{connectedMarketplaces.length}</div>
              <div className="text-sm text-muted-foreground">Ulangan marketplace</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Jami mahsulotlar</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Bugungi buyurtmalar</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">$0</div>
              <div className="text-sm text-muted-foreground">Bugungi daromad</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="marketplaces" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="marketplaces" className="gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Marketplacelar</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" className="gap-2">
              <Scan className="h-4 w-4" />
              <span className="hidden sm:inline">AI Scanner</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Mahsulotlar</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Buyurtmalar</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <ArrowDownUp className="h-4 w-4" />
              <span className="hidden sm:inline">Zaxira</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Narxlar</span>
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Joylash</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analitika</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Hisobotlar</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Bildirishnoma</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marketplaces">
            <MarketplaceOAuth 
              onConnect={(marketplace) => {
                setConnectedMarketplaces(prev => [...prev, marketplace]);
                toast.success(`${marketplace} muvaffaqiyatli ulandi!`);
              }}
              connectedMarketplaces={connectedMarketplaces}
            />
          </TabsContent>

          <TabsContent value="scanner">
            {connectedMarketplaces.length > 0 ? (
              <AIScannerPro shopId="sellercloud" />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Scan className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">AI Scanner Pro</h3>
                  <p className="text-muted-foreground mb-4">
                    Avval kamida bitta marketplace ulang
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="products">
            <MarketplaceProducts connectedMarketplaces={connectedMarketplaces} />
          </TabsContent>

          <TabsContent value="orders">
            <MarketplaceOrders connectedMarketplaces={connectedMarketplaces} />
          </TabsContent>

          <TabsContent value="inventory">
            <InventorySync connectedMarketplaces={connectedMarketplaces} />
          </TabsContent>

          <TabsContent value="pricing">
            <PriceManager connectedMarketplaces={connectedMarketplaces} />
          </TabsContent>

          <TabsContent value="publish">
            <MultiPublish connectedMarketplaces={connectedMarketplaces} />
          </TabsContent>

          <TabsContent value="analytics">
            <MarketplaceAnalytics connectedMarketplaces={connectedMarketplaces} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsExport connectedMarketplaces={connectedMarketplaces} />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationCenter />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
