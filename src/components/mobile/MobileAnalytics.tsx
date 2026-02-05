 import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
 import { DollarSign, Package, ShoppingCart, Globe, RefreshCw, WifiOff, AlertTriangle, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useMarketplaceProducts, useMarketplaceOrders, useInvalidateMarketplaceData } from '@/hooks/useMarketplaceData';
import { Badge } from '@/components/ui/badge';

interface MobileAnalyticsProps {
  connections: any[];
  connectedMarketplaces: string[];
}

const MARKETPLACE_EMOJI: Record<string, string> = {
  yandex: '🟡',
  uzum: '🟣',
  wildberries: '🔵',
  ozon: '🟢',
};

export function MobileAnalytics({ connections, connectedMarketplaces }: MobileAnalyticsProps) {
  const isOnline = navigator.onLine;
  
  const primaryMp = connectedMarketplaces[0] || null;
  
  const { 
    data: productsData, 
    isLoading: productsLoading,
    isFetching: productsFetching,
    dataUpdatedAt: productsUpdatedAt,
  } = useMarketplaceProducts(primaryMp);
  
  const { 
    data: ordersData,
    isLoading: ordersLoading,
    dataUpdatedAt: ordersUpdatedAt,
  } = useMarketplaceOrders(primaryMp);
  
  const { invalidateAll } = useInvalidateMarketplaceData();

  const isLoading = productsLoading || ordersLoading;
  const isFetching = productsFetching;
  const lastUpdated = ordersUpdatedAt ? new Date(ordersUpdatedAt) : (productsUpdatedAt ? new Date(productsUpdatedAt) : null);
  
  // Calculate ALL stats from actual order and product data
  const stats = useMemo(() => {
    const products = productsData?.data || [];
    const orders = ordersData?.data || [];
    
    // Products count - actual loaded SKUs
    const totalProducts = products.length;
    const totalOrders = orders.length;
    
    // Calculate revenue from delivered/completed orders
    // Note: Yandex statuses: PROCESSING, DELIVERY, PICKUP, DELIVERED, CANCELLED, RETURNED
    const completedOrders = orders.filter(o => 
      ['DELIVERED', 'PICKUP'].includes(o.status)
    );
    
    // Revenue calculation - sum up itemsTotal from orders
    let totalRevenue = 0;
    completedOrders.forEach(order => {
      // Try different price fields
      const orderTotal = order.itemsTotalUZS || order.itemsTotal || order.totalUZS || order.total || 0;
      totalRevenue += orderTotal;
    });
    
    // If no completed orders, show processing orders revenue as pending
    const processingOrders = orders.filter(o => 
      ['PROCESSING', 'DELIVERY'].includes(o.status)
    );
    let pendingRevenue = 0;
    processingOrders.forEach(order => {
      const orderTotal = order.itemsTotalUZS || order.itemsTotal || order.totalUZS || order.total || 0;
      pendingRevenue += orderTotal;
    });
    
    // Average check from all non-cancelled orders
    const validOrders = orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status));
    let avgCheck = 0;
    if (validOrders.length > 0) {
      const validTotal = validOrders.reduce((sum, o) => {
        return sum + (o.itemsTotalUZS || o.itemsTotal || o.totalUZS || o.total || 0);
      }, 0);
      avgCheck = Math.round(validTotal / validOrders.length);
    }
    
    // Order status counts
    const pendingCount = orders.filter(o => o.status === 'PENDING').length;
    const processingCount = orders.filter(o => ['PROCESSING', 'DELIVERY', 'PICKUP'].includes(o.status)).length;
    const deliveredCount = orders.filter(o => o.status === 'DELIVERED').length;
    const cancelledCount = orders.filter(o => ['CANCELLED', 'RETURNED'].includes(o.status)).length;
    
    // Stock alerts
    const lowStockProducts = products.filter(p => (p.stockCount || 0) > 0 && (p.stockCount || 0) < 5).length;
    const outOfStockProducts = products.filter(p => (p.stockCount || 0) === 0).length;
    
    // Top products by sales
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    orders.forEach(order => {
      if (['CANCELLED', 'RETURNED'].includes(order.status)) return;
      order.items?.forEach((item: any) => {
        const existing = productSales.get(item.offerId) || { name: item.offerName || '', quantity: 0, revenue: 0 };
        existing.quantity += item.count || 1;
        existing.revenue += (item.priceUZS || item.price || 0) * (item.count || 1);
        productSales.set(item.offerId, existing);
      });
    });
    
    const topProducts = Array.from(productSales.entries())
      .map(([offerId, data]) => ({ offerId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    return {
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue + pendingRevenue, // Show all non-cancelled revenue
      pendingRevenue,
      avgCheck,
      pendingOrders: pendingCount,
      processingOrders: processingCount,
      deliveredOrders: deliveredCount,
      cancelledOrders: cancelledCount,
      lowStockProducts,
      outOfStockProducts,
      topProducts,
    };
  }, [productsData?.data, ordersData?.data]);
 
  const handleRefresh = () => {
    if (!isOnline) {
      toast.error('Internet aloqasi yo\'q');
      return;
    }
    toast.info('Yangilanmoqda...');
    if (primaryMp) invalidateAll(primaryMp);
  };
 
  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    if (price >= 1000) return (price / 1000).toFixed(0) + ' ming';
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <div className="p-4 text-center">
        <Globe className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="font-semibold mb-2">Marketplace ulanmagan</h3>
        <p className="text-sm text-muted-foreground">
          Analitikani ko'rish uchun marketplace ulang
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-x-hidden">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Analitika</h2>
           <div className="flex items-center gap-2">
             {lastUpdated && (
               <p className="text-xs text-muted-foreground">
                 {lastUpdated.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} da yangilangan
               </p>
             )}
             {!isOnline && (
               <span className="text-xs text-yellow-600 flex items-center gap-1">
                 <WifiOff className="h-3 w-3" /> Offline
               </span>
             )}
           </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
           disabled={isFetching}
        >
           <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>
 
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Umumiy daromad</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <div className="text-xl font-bold text-primary truncate">
               {formatPrice(stats.totalRevenue)}
                <span className="text-xs font-normal text-muted-foreground ml-1">so'm</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-muted-foreground">O'rtacha chek</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-14" />
            ) : (
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400 truncate">
               {stats.avgCheck > 0 ? formatPrice(stats.avgCheck) : '—'}
                <span className="text-xs font-normal text-muted-foreground ml-1">so'm</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Buyurtmalar</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-14" />
            ) : (
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
               {stats.totalOrders}
                <span className="text-xs font-normal text-muted-foreground ml-1">ta</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Package className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Mahsulotlar</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-14" />
            ) : (
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
               {stats.totalProducts}
                <span className="text-xs font-normal text-muted-foreground ml-1">ta</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stock Alerts */}
      {(stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Zaxira ogohlantirishi</div>
              <div className="text-xs text-muted-foreground">
                {stats.outOfStockProducts > 0 && (
                  <span className="text-destructive">{stats.outOfStockProducts} ta tugagan</span>
                )}
                {stats.outOfStockProducts > 0 && stats.lowStockProducts > 0 && ' • '}
                {stats.lowStockProducts > 0 && (
                  <span>{stats.lowStockProducts} ta kam qolgan</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Status Breakdown */}
      {stats.totalOrders > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm px-1">Buyurtma holatlari</h3>
          <div className="flex flex-wrap gap-2">
            {stats.pendingOrders > 0 && (
              <Badge variant="secondary" className="text-xs">
                Kutilmoqda: {stats.pendingOrders}
              </Badge>
            )}
            {stats.processingOrders > 0 && (
              <Badge variant="default" className="text-xs">
                Jarayonda: {stats.processingOrders}
              </Badge>
            )}
            {stats.deliveredOrders > 0 && (
              <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                Yetkazilgan: {stats.deliveredOrders}
              </Badge>
            )}
            {stats.cancelledOrders > 0 && (
              <Badge variant="destructive" className="text-xs">
                Bekor: {stats.cancelledOrders}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Top Products */}
      {stats.topProducts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm px-1">Top mahsulotlar</h3>
          {stats.topProducts.slice(0, 3).map((product, idx) => (
            <Card key={product.offerId} className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-1">{product.name || 'Noma\'lum mahsulot'}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.quantity} dona sotilgan
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-primary text-sm">{formatPrice(product.revenue)}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connected Marketplaces */}
      {connectedMarketplaces.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm px-1">Ulangan marketplacelar</h3>
          <div className="flex flex-wrap gap-2">
            {connectedMarketplaces.map(mp => (
              <Badge key={mp} variant="secondary" className="text-xs capitalize">
                {MARKETPLACE_EMOJI[mp]} {mp}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
