import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useActivationStatus } from '@/hooks/useActivationStatus';
import { useShop } from '@/hooks/useShop';
import { useProducts } from '@/hooks/useProducts';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CreateShopDialog } from '@/components/seller/CreateShopDialog';
import { AddProductDialog } from '@/components/seller/AddProductDialog';
import { ProductList } from '@/components/seller/ProductList';
import { PendingProductsBanner } from '@/components/seller/PendingProductsBanner';
import { ProductForm } from '@/components/seller/ProductForm';
import { DropshippingImport } from '@/components/seller/DropshippingImport';
import { DropshippingProducts } from '@/components/seller/DropshippingProducts';
import { SellerAnalytics } from '@/components/seller/SellerAnalytics';
import { SellerBalanceCard } from '@/components/seller/SellerBalanceCard';
import { SellerOrders } from '@/components/seller/SellerOrders';
import { ProductBoost } from '@/components/seller/ProductBoost';
import { SellerPnL } from '@/components/seller/SellerPnL';
import { PromoCalculator } from '@/components/seller/PromoCalculator';
import { SalesDynamics } from '@/components/seller/SalesDynamics';
import { BarcodeGenerator } from '@/components/seller/BarcodeGenerator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { 
  Store, Package, TrendingUp, Eye, ExternalLink, Loader2, 
  Truck, BarChart3, Wallet, ShoppingCart, Globe, Crown, Rocket,
  DollarSign, Calculator, ScanBarcode
} from 'lucide-react';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

export default function SellerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isSeller, loading: rolesLoading } = useUserRoles();
  const { isSellerApproved, loading: activationLoading } = useActivationStatus();
  const { shop, loading: shopLoading, refetch: refetchShop } = useShop();
  const { products, loading: productsLoading, createProduct, updateProduct, deleteProduct, refetch: refetchProducts } = useProducts(shop?.id || null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropshippingRefresh, setDropshippingRefresh] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

   // Redirect if not a seller
   useEffect(() => {
     if (!authLoading && !rolesLoading && user && !isSeller) {
       navigate('/partnership');
     }
   }, [user, authLoading, rolesLoading, isSeller, navigate]);
 
  const handleCreateProduct = async (data: TablesInsert<'products'>) => {
    try {
      await createProduct(data);
      toast.success(t.productCreated);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t.error;
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleUpdateProduct = async (data: TablesInsert<'products'>) => {
    if (!editingProduct) return;
    setIsUpdating(true);
    try {
      await updateProduct(editingProduct.id, data);
      toast.success(t.productUpdated);
      setEditingProduct(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t.error;
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success(t.productDeleted);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t.error;
      toast.error(errorMessage);
    }
  };

  const handleDropshippingImported = () => {
    setDropshippingRefresh(prev => prev + 1);
    refetchProducts();
  };

  // Track initial load - never go back to full-page loader after first load completes
  // This prevents dialog unmount when auth token refreshes (e.g., returning from camera)
  const initialLoadDone = useRef(false);
  if (!authLoading && !shopLoading && !rolesLoading && !activationLoading) {
    initialLoadDone.current = true;
  }

  if (!initialLoadDone.current && (authLoading || shopLoading || rolesLoading || activationLoading)) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isSeller) {
    return null; // Will redirect
  }

  // Seller activation not approved
  if (!isSellerApproved) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Store className="h-12 w-12 mx-auto text-warning mb-4" />
          <h1 className="text-2xl font-bold mb-4">Aktivatsiya tasdiqlanmagan</h1>
          <p className="text-muted-foreground mb-6">
            Sizning sotuvchi profilingiz hali admin tomonidan tasdiqlanmagan. Iltimos kuting yoki aktivatsiya sahifasini tekshiring.
          </p>
          <Button asChild>
            <Link to="/seller-activation">Aktivatsiya holatini ko'rish</Link>
          </Button>
        </div>
      </Layout>
    );
  }
 
  if (!shop) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
            <h1 className="text-2xl font-bold mb-2">{t.noShop}</h1>
            <p className="text-muted-foreground mb-6">{t.createShopDesc}</p>
            <CreateShopDialog onSuccess={refetchShop} />
          </div>
        </div>
      </Layout>
    );
  }

  const activeProducts = products.filter(p => p.status === 'active').length;
  const dropshippingProducts = products.filter(p => p.source === 'dropshipping').length;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{shop.name}</h1>
              <p className="text-sm text-muted-foreground">Dubay Mall do'koni</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={`/shop/${shop.slug}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                {t.viewShop}
              </a>
            </Button>
          </div>
        </div>

        {/* SellerCloudX Promo */}
        <Card className="mb-6 border-warning/30 bg-gradient-to-r from-warning/5 to-destructive/5">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  SellerCloudX
                  <Badge variant="secondary" className="text-xs">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Uzum, Yandex, Wildberries, Ozon - hammasi bitta joyda
                </p>
              </div>
            </div>
            <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90">
              <Link to="/seller-cloud">
                <Crown className="mr-2 h-4 w-4" />
                O'tish
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-xs">{t.totalProducts}</span>
              </div>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-xs">{t.statusActive}</span>
              </div>
              <div className="text-2xl font-bold">{activeProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Truck className="h-4 w-4" />
                <span className="text-xs">Dropshipping</span>
              </div>
              <div className="text-2xl font-bold">{dropshippingProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">{t.totalSales}</span>
              </div>
              <div className="text-2xl font-bold">{shop.total_sales || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <ScrollArea className="w-full sm:w-auto whitespace-nowrap">
              <TabsList className="inline-flex">
                <TabsTrigger value="products" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.products}</span>
                </TabsTrigger>
                <TabsTrigger value="dropshipping" className="gap-2">
                  <Truck className="h-4 w-4" />
                  <span className="hidden sm:inline">Dropshipping</span>
                </TabsTrigger>
                <TabsTrigger value="orders" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">Buyurtmalar</span>
                </TabsTrigger>
                <TabsTrigger value="boost" className="gap-2">
                  <Rocket className="h-4 w-4" />
                  <span className="hidden sm:inline">Reklama</span>
                </TabsTrigger>
                <TabsTrigger value="pnl" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">PnL</span>
                </TabsTrigger>
                <TabsTrigger value="dynamics" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Dinamika</span>
                </TabsTrigger>
                <TabsTrigger value="promo-calc" className="gap-2">
                  <Calculator className="h-4 w-4" />
                  <span className="hidden sm:inline">Kalkulyator</span>
                </TabsTrigger>
                <TabsTrigger value="barcode" className="gap-2">
                  <ScanBarcode className="h-4 w-4" />
                  <span className="hidden sm:inline">Shtrix-kod</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analitika</span>
                </TabsTrigger>
                <TabsTrigger value="balance" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Balans</span>
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <AddProductDialog shopId={shop.id} onSubmit={handleCreateProduct} />
          </div>

          <TabsContent value="products">
            <PendingProductsBanner />
            <ProductList
              products={products}
              loading={productsLoading}
              onEdit={setEditingProduct}
              onDelete={handleDeleteProduct}
              onRefresh={refetchProducts}
            />
          </TabsContent>

          <TabsContent value="dropshipping" className="space-y-6">
            <DropshippingImport 
              shopId={shop.id} 
              onProductImported={handleDropshippingImported} 
            />
            <DropshippingProducts 
              shopId={shop.id} 
              refreshTrigger={dropshippingRefresh} 
            />
          </TabsContent>

          <TabsContent value="orders">
            <SellerOrders />
          </TabsContent>

          <TabsContent value="boost">
            <ProductBoost shopId={shop.id} />
          </TabsContent>

          <TabsContent value="pnl">
            <SellerPnL shopId={shop.id} />
          </TabsContent>

          <TabsContent value="dynamics">
            <SalesDynamics shopId={shop.id} />
          </TabsContent>

          <TabsContent value="promo-calc">
            <PromoCalculator />
          </TabsContent>

          <TabsContent value="barcode">
            <BarcodeGenerator shopId={shop.id} />
          </TabsContent>

          <TabsContent value="analytics">
            <SellerAnalytics shopId={shop.id} />
          </TabsContent>

          <TabsContent value="balance">
            <SellerBalanceCard />
          </TabsContent>
        </Tabs>

        {/* Edit Product Sheet */}
        <Sheet open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <SheetContent className="sm:max-w-[500px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t.edit}</SheetTitle>
              <SheetDescription>Mahsulot ma'lumotlarini tahrirlash</SheetDescription>
            </SheetHeader>
            {editingProduct && (
              <div className="mt-6">
                <ProductForm
                  shopId={shop.id}
                  initialData={editingProduct}
                  onSubmit={handleUpdateProduct}
                  onCancel={() => setEditingProduct(null)}
                  isLoading={isUpdating}
                />
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
