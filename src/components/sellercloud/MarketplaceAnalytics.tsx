import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, DollarSign, Package, ShoppingCart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketplaceAnalyticsProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

interface MarketplaceStats {
  marketplace: string;
  productsCount: number;
  ordersCount: number;
  totalRevenue: number;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
};

export function MarketplaceAnalytics({ connectedMarketplaces, fetchMarketplaceData }: MarketplaceAnalyticsProps) {
  const [stats, setStats] = useState<MarketplaceStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totals, setTotals] = useState({ products: 0, orders: 0, revenue: 0 });

  useEffect(() => {
    if (connectedMarketplaces.length > 0) {
      loadAnalytics();
    } else {
      setIsLoading(false);
    }
  }, [connectedMarketplaces]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    
    try {
      const marketplaceStats: MarketplaceStats[] = [];
      let totalProducts = 0;
      let totalOrders = 0;
      let totalRevenue = 0;

      for (const marketplace of connectedMarketplaces) {
        // Fetch all products and orders
        const [productsResult, ordersResult] = await Promise.all([
          fetchMarketplaceData(marketplace, 'products', { limit: 200, fetchAll: true }),
          fetchMarketplaceData(marketplace, 'orders', { fetchAll: true }),
        ]);

        const productsCount = productsResult.total || productsResult.data?.length || 0;
        const orders = ordersResult.data || [];
        const ordersCount = orders.length;
        
        // Calculate revenue from orders (use UZS converted value)
        const revenue = orders.reduce((sum: number, order: any) => {
          // Use totalUZS if available (converted from RUB), otherwise use total
          const orderTotal = order.totalUZS || order.total || 0;
          return sum + orderTotal;
        }, 0);

        console.log(`${marketplace}: ${productsCount} products, ${ordersCount} orders, ${revenue} so'm revenue`);

        marketplaceStats.push({
          marketplace,
          productsCount,
          ordersCount,
          totalRevenue: revenue,
        });

        totalProducts += productsCount;
        totalOrders += ordersCount;
        totalRevenue += revenue;
      }

      setStats(marketplaceStats);
      setTotals({ products: totalProducts, orders: totalOrders, revenue: totalRevenue });
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + ' mln so\'m';
    }
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Analitika mavjud emas</h3>
          <p className="text-muted-foreground mb-4">
            Analitikani ko'rish uchun avval marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Jami daromad</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-xl md:text-2xl font-bold">{formatPrice(totals.revenue)}</div>
                <div className="text-xs text-muted-foreground">So'nggi 30 kun</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-sm">Buyurtmalar</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-xl md:text-2xl font-bold">{totals.orders}</div>
                <div className="text-xs text-muted-foreground">So'nggi 30 kun</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" />
              <span className="text-sm">Mahsulotlar</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-xl md:text-2xl font-bold">{totals.products}</div>
                <div className="text-xs text-muted-foreground">Jami</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">O'rtacha chek</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-xl md:text-2xl font-bold">
                  {totals.orders > 0 ? formatPrice(Math.round(totals.revenue / totals.orders)) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Buyurtma uchun</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Marketplace breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Marketplace bo'yicha statistika</CardTitle>
              <CardDescription>Har bir marketplace uchun alohida ko'rsatkichlar</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
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
