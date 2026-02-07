import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, Package, AlertTriangle, Check, 
  ArrowDownUp, Clock, Settings
} from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface InventorySyncProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex', uzum: 'Uzum', wildberries: 'WB', ozon: 'Ozon',
};

interface ProductStock {
  id: string;
  name: string;
  sku: string;
  stockFBO: number;
  stockFBS: number;
  totalStock: number;
  lowStockAlert: boolean;
  marketplace: string;
}

const LOW_STOCK_THRESHOLD = 10;

export function InventorySync({ connectedMarketplaces, store }: InventorySyncProps) {
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval] = useState(30);
  const isLoading = store.isLoadingProducts;

  const products = useMemo(() => {
    const allProducts: ProductStock[] = [];
    for (const marketplace of connectedMarketplaces) {
      const marketplaceProducts = store.getProducts(marketplace);
      marketplaceProducts.forEach(product => {
        const stockFBO = product.stockFBO || 0;
        const stockFBS = product.stockFBS || 0;
        const totalStock = stockFBO + stockFBS;
        allProducts.push({
          id: product.offerId,
          name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId,
          stockFBO, stockFBS, totalStock,
          lowStockAlert: totalStock < LOW_STOCK_THRESHOLD,
          marketplace,
        });
      });
    }
    return allProducts;
  }, [connectedMarketplaces, store.allProducts.length]);

  const lowStockCount = products.filter(p => p.lowStockAlert).length;
  const outOfStockCount = products.filter(p => p.totalStock === 0).length;
  const inStockCount = products.filter(p => p.totalStock > 0 && !p.lowStockAlert).length;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ArrowDownUp className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Zaxira sinxronizatsiyasi</h3>
          <p className="text-muted-foreground mb-4">Avval marketplace ulang</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />Sinxronizatsiya sozlamalari
              </CardTitle>
              <CardDescription>Zaxira avtomatik yangilanishi</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchProducts()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${store.isFetching ? 'animate-spin' : ''}`} />Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Avtomatik sinxronizatsiya</div>
              <div className="text-sm text-muted-foreground">Har {syncInterval} daqiqada</div>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </CardContent>
      </Card>

      {/* Stock Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <Check className="h-4 w-4" /><span className="text-sm">Mavjud</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{inStockCount}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <AlertTriangle className="h-4 w-4" /><span className="text-sm">Kam</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold text-amber-600">{lowStockCount}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <Package className="h-4 w-4" /><span className="text-sm">Tugagan</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold text-red-600">{outOfStockCount}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Product Stock List */}
      <Card>
        <CardHeader>
          <CardTitle>Zaxira holati</CardTitle>
          <CardDescription>{products.length} ta mahsulot</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Mahsulotlar topilmadi</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {products
                .sort((a, b) => a.totalStock - b.totalStock)
                .map(product => (
                  <div key={`${product.id}-${product.marketplace}`} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{product.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{MARKETPLACE_NAMES[product.marketplace]}</Badge>
                        <span>{product.sku}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">FBO</div>
                        <div className="font-medium">{product.stockFBO}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">FBS</div>
                        <div className="font-medium">{product.stockFBS}</div>
                      </div>
                      <Badge variant={product.totalStock === 0 ? 'destructive' : product.lowStockAlert ? 'outline' : 'default'}
                        className={product.lowStockAlert && product.totalStock > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : ''}>
                        {product.totalStock}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
