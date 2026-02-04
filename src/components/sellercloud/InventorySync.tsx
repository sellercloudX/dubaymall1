import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, Package, AlertTriangle, Check, 
  ArrowDownUp, Clock, Settings
} from 'lucide-react';

interface InventorySyncProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex',
  uzum: 'Uzum',
  wildberries: 'WB',
  ozon: 'Ozon',
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

export function InventorySync({ connectedMarketplaces, fetchMarketplaceData }: InventorySyncProps) {
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const LOW_STOCK_THRESHOLD = 10;

  useEffect(() => {
    if (connectedMarketplaces.length > 0) {
      loadProductsFromMarketplaces();
    } else {
      setIsLoading(false);
    }
  }, [connectedMarketplaces]);

  const loadProductsFromMarketplaces = async () => {
    setIsLoading(true);
    
    try {
      const allProducts: ProductStock[] = [];

      for (const marketplace of connectedMarketplaces) {
        // Fetch all products with stock data
        const result = await fetchMarketplaceData(marketplace, 'products', { 
          limit: 200, 
          fetchAll: true 
        });
        
        if (result.success && result.data) {
          result.data.forEach((product: any) => {
            const stockFBO = product.stockFBO || 0;
            const stockFBS = product.stockFBS || 0;
            const totalStock = stockFBO + stockFBS;
            
            allProducts.push({
              id: product.offerId,
              name: product.name || 'Nomsiz',
              sku: product.shopSku || product.offerId,
              stockFBO,
              stockFBS,
              totalStock,
              lowStockAlert: totalStock < LOW_STOCK_THRESHOLD,
              marketplace,
            });
          });
        }
      }

      setProducts(allProducts);
      setLastSyncTime(new Date().toISOString());
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await loadProductsFromMarketplaces();
    setIsSyncing(false);
  };

  const lowStockCount = products.filter(p => p.lowStockAlert).length;
  const totalFBO = products.reduce((sum, p) => sum + p.stockFBO, 0);
  const totalFBS = products.reduce((sum, p) => sum + p.stockFBS, 0);

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Hali sinxronlanmagan';
    const diff = Math.round((Date.now() - new Date(lastSyncTime).getTime()) / 60000);
    if (diff < 1) return 'Hozirgina';
    if (diff < 60) return `${diff} daqiqa oldin`;
    return `${Math.round(diff / 60)} soat oldin`;
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ArrowDownUp className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Zaxira sinxronizatsiya</h3>
          <p className="text-muted-foreground mb-4">
            Avval kamida bitta marketplace ulang
          </p>
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
                <ArrowDownUp className="h-5 w-5" />
                Zaxira sinxronizatsiyasi
              </CardTitle>
              <CardDescription>
                Barcha marketplacedagi zaxiralarni avtomatik sinxronlash
              </CardDescription>
            </div>
            <Button onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sinxronlanmoqda...' : 'Hozir sinxronlash'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Auto Sync Toggle */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Avto-sinxron</span>
                  </div>
                  <Switch checked={autoSync} onCheckedChange={setAutoSync} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Har {syncInterval} daqiqada
                </p>
              </CardContent>
            </Card>

            {/* Sync Status */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Sinxronlash</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatLastSync()} • {products.length} ta
                </p>
              </CardContent>
            </Card>

            {/* FBO Stock */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">FBO (Yandex)</span>
                </div>
                <p className="text-lg font-bold">{totalFBO} dona</p>
              </CardContent>
            </Card>

            {/* Low Stock Alert */}
            <Card className={lowStockCount > 0 ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/50'}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`h-4 w-4 ${lowStockCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Kam qoldiq</span>
                </div>
                <p className={`text-lg font-bold ${lowStockCount > 0 ? 'text-destructive' : ''}`}>
                  {lowStockCount} ta
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Product Stocks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mahsulotlar zaxirasi
            {products.length > 0 && (
              <Badge variant="secondary" className="ml-2">{products.length} ta</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Barcha marketplacedagi FBO va FBS zaxira holati
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Mahsulotlar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">Mahsulot</th>
                    <th className="text-left py-3 px-2 text-sm font-medium w-28">SKU</th>
                    <th className="text-left py-3 px-2 text-sm font-medium w-20">MP</th>
                    <th className="text-center py-3 px-2 text-sm font-medium w-20">FBO</th>
                    <th className="text-center py-3 px-2 text-sm font-medium w-20">FBS</th>
                    <th className="text-center py-3 px-2 text-sm font-medium w-20">Jami</th>
                    <th className="text-center py-3 px-2 text-sm font-medium w-20">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 100).map(product => (
                    <tr key={`${product.id}-${product.marketplace}`} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="font-medium text-sm line-clamp-1">{product.name}</div>
                      </td>
                      <td className="py-3 px-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block max-w-[100px]">{product.sku}</code>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">
                          {MARKETPLACE_NAMES[product.marketplace]}
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className={`font-medium ${product.stockFBO < LOW_STOCK_THRESHOLD ? 'text-muted-foreground' : ''}`}>
                          {product.stockFBO}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className={`font-medium ${product.stockFBS < LOW_STOCK_THRESHOLD ? 'text-destructive' : 'text-green-600'}`}>
                          {product.stockFBS}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className="font-bold">{product.totalStock}</span>
                      </td>
                      <td className="text-center py-3 px-2">
                        {product.lowStockAlert ? (
                          <Badge variant="destructive" className="text-xs whitespace-nowrap">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Kam
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            <Check className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length > 100 && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  Ko'rsatilmoqda: 100 / {products.length} mahsulot
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sinxronlash qoidalari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Kam qoldiq chegarasi</div>
                  <div className="text-xs text-muted-foreground">Ogohlantirish chiqarish</div>
                </div>
                <Badge variant="outline">{LOW_STOCK_THRESHOLD} dona</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Nol qoldiqda bloklash</div>
                  <div className="text-xs text-muted-foreground">Avtomatik deaktivatsiya</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Email bildirishnoma</div>
                  <div className="text-xs text-muted-foreground">Kam qoldiqda xabar</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Telegram bot</div>
                  <div className="text-xs text-muted-foreground">Tezkor bildirishnomalar</div>
                </div>
                <Switch />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
