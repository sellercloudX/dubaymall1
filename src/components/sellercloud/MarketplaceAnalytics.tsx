import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, DollarSign, Package, ShoppingCart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface MarketplaceAnalyticsProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
};

export function MarketplaceAnalytics({ connectedMarketplaces, store }: MarketplaceAnalyticsProps) {
  const isLoading = store.isLoading;

  const { stats, totals } = useMemo(() => {
    const marketplaceStats = connectedMarketplaces.map(marketplace => {
      const products = store.getProducts(marketplace);
      const orders = store.getOrders(marketplace);
      const productsCount = products.length;
      const ordersCount = orders.length;
      // Only count revenue from non-cancelled orders
      const activeOrders = orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status));
      const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.totalUZS || order.total || 0), 0);

      return { marketplace, productsCount, ordersCount, totalRevenue };
    });

    const totalProducts = marketplaceStats.reduce((s, m) => s + m.productsCount, 0);
    const totalOrders = marketplaceStats.reduce((s, m) => s + m.ordersCount, 0);
    const totalRevenue = marketplaceStats.reduce((s, m) => s + m.totalRevenue, 0);

    return {
      stats: marketplaceStats,
      totals: { products: totalProducts, orders: totalOrders, revenue: totalRevenue },
    };
  }, [connectedMarketplaces, store.dataVersion]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Analitika mavjud emas</h3>
          <p className="text-muted-foreground mb-4">Analitikani ko'rish uchun avval marketplace ulang</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" /><span className="text-sm">Jami daromad</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <><div className="text-xl md:text-2xl font-bold">{formatPrice(totals.revenue)}</div>
              <div className="text-xs text-muted-foreground">So'nggi 30 kun</div></>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ShoppingCart className="h-4 w-4" /><span className="text-sm">Buyurtmalar</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <><div className="text-xl md:text-2xl font-bold">{totals.orders}</div>
              <div className="text-xs text-muted-foreground">So'nggi 30 kun</div></>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" /><span className="text-sm">Mahsulotlar</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <><div className="text-xl md:text-2xl font-bold">{totals.products}</div>
              <div className="text-xs text-muted-foreground">Jami</div></>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" /><span className="text-sm">O'rtacha chek</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <><div className="text-xl md:text-2xl font-bold">
                {totals.orders > 0 ? formatPrice(Math.round(totals.revenue / totals.orders)) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Buyurtma uchun</div></>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Marketplace bo'yicha statistika</CardTitle>
              <CardDescription>Har bir marketplace uchun alohida ko'rsatkichlar</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${store.isFetching ? 'animate-spin' : ''}`} />
              Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="space-y-4">
              {stats.map((stat) => (
                <div key={stat.marketplace} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {stat.marketplace === 'yandex' ? '🟡' : stat.marketplace === 'uzum' ? '🟣' : '📦'}
                    </div>
                    <div>
                      <div className="font-medium">{MARKETPLACE_NAMES[stat.marketplace] || stat.marketplace}</div>
                      <div className="text-sm text-muted-foreground">{stat.productsCount} mahsulot</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatPrice(stat.totalRevenue)}</div>
                    <div className="text-sm text-muted-foreground">{stat.ordersCount} buyurtma</div>
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
