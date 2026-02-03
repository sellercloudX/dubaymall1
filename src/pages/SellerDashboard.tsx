import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShop } from '@/hooks/useShop';
import { useProducts } from '@/hooks/useProducts';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateShopDialog } from '@/components/seller/CreateShopDialog';
import { AddProductDialog } from '@/components/seller/AddProductDialog';
import { ProductList } from '@/components/seller/ProductList';
import { ProductForm } from '@/components/seller/ProductForm';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Store, Package, TrendingUp, Eye, ExternalLink, Loader2 } from 'lucide-react';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

export default function SellerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { shop, loading: shopLoading, refetch: refetchShop } = useShop();
  const { products, loading: productsLoading, createProduct, updateProduct, deleteProduct, refetch: refetchProducts } = useProducts(shop?.id || null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleCreateProduct = async (data: TablesInsert<'products'>) => {
    try {
      await createProduct(data);
      toast.success(t.productCreated);
    } catch (error: any) {
      toast.error(error.message || t.error);
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
    } catch (error: any) {
      toast.error(error.message || t.error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success(t.productDeleted);
    } catch (error: any) {
      toast.error(error.message || t.error);
    }
  };

  if (authLoading || shopLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // No shop yet
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{shop.name}</h1>
            <p className="text-muted-foreground">{t.manageShop}</p>
          </div>
          <Button variant="outline" asChild>
            <a href={`/shop/${shop.slug}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t.viewShop}
            </a>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t.totalProducts}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{products.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t.statusActive}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-success" />
                <span className="text-2xl font-bold">{activeProducts}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t.totalSales}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span className="text-2xl font-bold">{shop.total_sales || 0}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reyting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{shop.rating || 0}</span>
                <span className="text-muted-foreground">/ 5</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList>
              <TabsTrigger value="products">{t.products}</TabsTrigger>
              <TabsTrigger value="settings">{t.shopSettings}</TabsTrigger>
            </TabsList>
            <AddProductDialog shopId={shop.id} onSubmit={handleCreateProduct} />
          </div>

          <TabsContent value="products">
            <ProductList
              products={products}
              loading={productsLoading}
              onEdit={setEditingProduct}
              onDelete={handleDeleteProduct}
              onRefresh={refetchProducts}
            />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>{t.shopSettings}</CardTitle>
                <CardDescription>Do'kon sozlamalarini tahrirlash</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Tez orada...</p>
              </CardContent>
            </Card>
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