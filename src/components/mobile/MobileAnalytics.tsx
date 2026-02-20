import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DollarSign, Package, ShoppingCart, Globe, RefreshCw, WifiOff, AlertTriangle, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface MobileAnalyticsProps {
  connections: any[];
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_EMOJI: Record<string, string> = {
  yandex: '🟡',
  uzum: '🟣',
  wildberries: '🔵',
  ozon: '🟢',
};

export function MobileAnalytics({ connections, connectedMarketplaces, store }: MobileAnalyticsProps) {
  const isOnline = navigator.onLine;
  const isLoading = store.isLoading;
  const isFetching = store.isFetching;

  // Calculate ALL stats from centralized store data across ALL marketplaces
  const stats = useMemo(() => {
    const allProducts = store.allProducts;
    const allOrders = store.allOrders;

    const totalProducts = allProducts.length;
    const totalOrders = allOrders.length;

    // Revenue from non-cancelled orders
    const validOrders = allOrders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status));
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalUZS || o.total || 0), 0);

    // Average check
    const avgCheck = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

    // Order status counts
    const pendingOrders = allOrders.filter(o => o.status === 'PENDING').length;
    const processingOrders = allOrders.filter(o => ['PROCESSING', 'DELIVERY', 'PICKUP'].includes(o.status)).length;
    const deliveredOrders = allOrders.filter(o => o.status === 'DELIVERED').length;
    const cancelledOrders = allOrders.filter(o => ['CANCELLED', 'RETURNED'].includes(o.status)).length;

    // Stock alerts
    const lowStockProducts = allProducts.filter(p => (p.stockCount || 0) > 0 && (p.stockCount || 0) < 5).length;
    const outOfStockProducts = allProducts.filter(p => (p.stockCount || 0) === 0).length;

    // Top products by sales from real order items
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    allOrders.forEach(order => {
      if (['CANCELLED', 'RETURNED'].includes(order.status)) return;
      order.items?.forEach(item => {
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
      totalProducts, totalOrders, totalRevenue, avgCheck,
      pendingOrders, processingOrders, deliveredOrders, cancelledOrders,
      lowStockProducts, outOfStockProducts, topProducts,
    };
  }, [store.dataVersion]);

  const handleRefresh = () => {
    if (!isOnline) {
      toast.error("Internet aloqasi yo'q");
      return;
    }
    toast.info('Yangilanmoqda...');
    store.refetchAll();
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
        <p className="text-sm text-muted-foreground">Analitikani ko'rish uchun marketplace ulang</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Analitika</h2>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Umumiy daromad</span>
            </div>
            {isLoading ? <Skeleton className="h-6 w-20" /> : (
              <div className="text-xl font-bold text-primary truncate">
                {formatPrice(stats.totalRevenue)}
                <span className="text-xs font-normal text-muted-foreground ml-1">so'm</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/30 to-accent/10 border-accent/30 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-4 w-4 text-accent-foreground" />
              <span className="text-xs text-muted-foreground">O'rtacha chek</span>
            </div>
            {isLoading ? <Skeleton className="h-6 w-14" /> : (
              <div className="text-xl font-bold text-accent-foreground truncate">
                {stats.avgCheck > 0 ? formatPrice(stats.avgCheck) : '—'}
                <span className="text-xs font-normal text-muted-foreground ml-1">so'm</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/50 to-secondary/20 border-secondary/40 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShoppingCart className="h-4 w-4 text-secondary-foreground" />
              <span className="text-xs text-muted-foreground">Buyurtmalar</span>
            </div>
            {isLoading ? <Skeleton className="h-6 w-14" /> : (
              <div className="text-xl font-bold text-secondary-foreground">
                {stats.totalOrders}
                <span className="text-xs font-normal text-muted-foreground ml-1">ta</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-muted to-muted/50 border-muted-foreground/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Mahsulotlar</span>
            </div>
            {isLoading ? <Skeleton className="h-6 w-14" /> : (
              <div className="text-xl font-bold text-foreground">
                {stats.totalProducts}
                <span className="text-xs font-normal text-muted-foreground ml-1">ta</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Zaxira ogohlantirishi</div>
              <div className="text-xs text-muted-foreground">
                {stats.outOfStockProducts > 0 && <span className="text-destructive">{stats.outOfStockProducts} ta tugagan</span>}
                {stats.outOfStockProducts > 0 && stats.lowStockProducts > 0 && ' • '}
                {stats.lowStockProducts > 0 && <span>{stats.lowStockProducts} ta kam qolgan</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.totalOrders > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm px-1">Buyurtma holatlari</h3>
          <div className="flex flex-wrap gap-2">
            {stats.pendingOrders > 0 && <Badge variant="secondary" className="text-xs">Kutilmoqda: {stats.pendingOrders}</Badge>}
            {stats.processingOrders > 0 && <Badge variant="default" className="text-xs">Jarayonda: {stats.processingOrders}</Badge>}
            {stats.deliveredOrders > 0 && <Badge variant="outline" className="text-xs border-primary text-primary">Yetkazilgan: {stats.deliveredOrders}</Badge>}
            {stats.cancelledOrders > 0 && <Badge variant="destructive" className="text-xs">Bekor: {stats.cancelledOrders}</Badge>}
          </div>
        </div>
      )}

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
                  <div className="text-sm font-medium line-clamp-1">{product.name || "Noma'lum mahsulot"}</div>
                  <div className="text-xs text-muted-foreground">{product.quantity} dona sotilgan</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-primary text-sm">{formatPrice(product.revenue)}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
