import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, DollarSign, Package, ShoppingCart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent-foreground))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--destructive))',
];

export function MarketplaceAnalytics({ connectedMarketplaces, store }: MarketplaceAnalyticsProps) {
  const isLoading = store.isLoading;

  const { stats, totals, revenueChartData, orderStatusData } = useMemo(() => {
    const marketplaceStats = connectedMarketplaces.map(marketplace => {
      const products = store.getProducts(marketplace);
      const orders = store.getOrders(marketplace);
      const productsCount = products.length;
      const ordersCount = orders.length;
      const activeOrders = orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status));
      const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.totalUZS || order.total || 0), 0);

      return { marketplace, productsCount, ordersCount, totalRevenue };
    });

    const totalProducts = marketplaceStats.reduce((s, m) => s + m.productsCount, 0);
    const totalOrders = marketplaceStats.reduce((s, m) => s + m.ordersCount, 0);
    const totalRevenue = marketplaceStats.reduce((s, m) => s + m.totalRevenue, 0);

    // Revenue bar chart data
    const revenueChart = marketplaceStats.map(s => ({
      name: MARKETPLACE_NAMES[s.marketplace]?.split(' ')[0] || s.marketplace,
      revenue: Math.round(s.totalRevenue / 1000), // in thousands
      orders: s.ordersCount,
      products: s.productsCount,
    }));

    // Order status pie chart
    const statusCounts: Record<string, number> = {};
    connectedMarketplaces.forEach(mp => {
      store.getOrders(mp).forEach(o => {
        const label = o.status === 'DELIVERED' ? 'Yetkazildi' :
          o.status === 'PROCESSING' ? 'Jarayonda' :
          o.status === 'DELIVERY' ? 'Yo\'lda' :
          o.status === 'CANCELLED' ? 'Bekor' : 'Boshqa';
        statusCounts[label] = (statusCounts[label] || 0) + 1;
      });
    });
    const orderStatus = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    return {
      stats: marketplaceStats,
      totals: { products: totalProducts, orders: totalOrders, revenue: totalRevenue },
      revenueChartData: revenueChart,
      orderStatusData: orderStatus,
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
      {/* KPI Cards */}
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

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by marketplace */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Marketplace bo'yicha daromad (ming so'm)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                    formatter={(value: number) => [`${value} ming so'm`, 'Daromad']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Ma'lumot yo'q</div>
            )}
          </CardContent>
        </Card>

        {/* Order status pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Buyurtma holatlari</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : orderStatusData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={orderStatusData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {orderStatusData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {orderStatusData.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Ma'lumot yo'q</div>
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