import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, Package, ShoppingCart, Globe, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface MobileAnalyticsProps {
  connections: any[];
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

const MARKETPLACE_EMOJI: Record<string, string> = {
  yandex: '🟡',
  uzum: '🟣',
  wildberries: '🔵',
  ozon: '🟢',
};

export function MobileAnalytics({ connections, connectedMarketplaces, fetchMarketplaceData }: MobileAnalyticsProps) {
  const [stats, setStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totals, setTotals] = useState({ products: 0, orders: 0, revenue: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [connectedMarketplaces]);

  const loadAnalytics = async (showRefreshToast = false) => {
    if (connectedMarketplaces.length === 0) {
      setIsLoading(false);
      return;
    }
    
    if (showRefreshToast) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      let totalProducts = 0;
      let totalOrders = 0;
      let totalRevenue = 0;
      const marketplaceStats: any[] = [];

      // Parallel fetch for all marketplaces
      const results = await Promise.all(
        connectedMarketplaces.map(async (mp) => {
          const [productsResult, ordersResult] = await Promise.all([
            fetchMarketplaceData(mp, 'products', { limit: 200, fetchAll: true }),
            fetchMarketplaceData(mp, 'orders', { fetchAll: true }),
          ]);
          return { mp, productsResult, ordersResult };
        })
      );

      for (const { mp, productsResult, ordersResult } of results) {
        const productsCount = productsResult.total || productsResult.data?.length || 0;
        const orders = ordersResult.data || [];
        const ordersCount = orders.length;
        const revenue = orders.reduce((sum: number, o: any) => sum + (o.totalUZS || o.total || 0), 0);

        marketplaceStats.push({ marketplace: mp, productsCount, ordersCount, revenue });
        totalProducts += productsCount;
        totalOrders += ordersCount;
        totalRevenue += revenue;
      }

      setStats(marketplaceStats);
      setTotals({ products: totalProducts, orders: totalOrders, revenue: totalRevenue });
      setLastUpdated(new Date());
      
      if (showRefreshToast) {
        toast.success('Ma\'lumotlar yangilandi!');
      }
    } catch (err) {
      console.error('Analytics error:', err);
      if (showRefreshToast) {
        toast.error('Yangilashda xato');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadAnalytics(true);
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
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              {lastUpdated.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} da yangilangan
            </p>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>
 
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Daromad</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <div className="text-lg font-bold text-green-700 dark:text-green-400 truncate">
                {formatPrice(totals.revenue)}
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
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {totals.orders}
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
              <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                {totals.products}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-muted-foreground">O'rtacha</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <div className="text-lg font-bold text-orange-700 dark:text-orange-400 truncate">
                {totals.orders > 0 ? formatPrice(Math.round(totals.revenue / totals.orders)) : '—'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per Marketplace */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm px-1">Marketplace bo'yicha</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : (
          stats.map((stat) => (
            <Card key={stat.marketplace} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center p-3 gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
                    {MARKETPLACE_EMOJI[stat.marketplace] || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold capitalize text-sm truncate">{stat.marketplace}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {stat.productsCount} mahsulot • {stat.ordersCount} buyurtma
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-primary text-sm">{formatPrice(stat.revenue)}</div>
                    <div className="text-[10px] text-muted-foreground">so'm</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
