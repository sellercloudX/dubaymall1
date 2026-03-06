import { useMemo } from 'react';
import { MarketplaceLogo, MARKETPLACE_SHORT_NAMES } from '@/lib/marketplaceConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, DollarSign, Package, ShoppingCart, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { toDisplayUzs } from '@/lib/currency';

interface MarketplaceAnalyticsProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'WB',
  ozon: 'Ozon',
};

const CHART_COLORS = [
  'hsl(var(--chart-1, var(--primary)))',
  'hsl(var(--chart-2, 220 70% 50%))',
  'hsl(var(--chart-3, 340 75% 55%))',
  'hsl(var(--chart-4, 30 80% 55%))',
];

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '12px',
};

export function MarketplaceAnalytics({ connectedMarketplaces, store }: MarketplaceAnalyticsProps) {
  const isLoading = store.isLoading;

  const { stats, totals, revenueChartData, orderStatusData, dailyRevenueData, topProducts } = useMemo(() => {
    const marketplaceStats = connectedMarketplaces.map(marketplace => {
      const products = store.getProducts(marketplace);
      const orders = store.getOrders(marketplace);
      const productsCount = products.length;
      const ordersCount = orders.length;
      const activeOrders = orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status));
      const totalRevenue = activeOrders.reduce((sum, order) => sum + toDisplayUzs(order.total || 0, marketplace), 0);
      const cancelledOrders = orders.filter(o => ['CANCELLED', 'RETURNED'].includes(o.status)).length;
      const cancelRate = ordersCount > 0 ? ((cancelledOrders / ordersCount) * 100).toFixed(1) : '0';

      return { marketplace, productsCount, ordersCount, totalRevenue, cancelledOrders, cancelRate };
    });

    const totalProducts = marketplaceStats.reduce((s, m) => s + m.productsCount, 0);
    const totalOrders = marketplaceStats.reduce((s, m) => s + m.ordersCount, 0);
    const totalRevenue = marketplaceStats.reduce((s, m) => s + m.totalRevenue, 0);
    const totalCancelled = marketplaceStats.reduce((s, m) => s + m.cancelledOrders, 0);

    // Revenue bar chart data
    const revenueChart = marketplaceStats.map((s, i) => ({
      name: MARKETPLACE_NAMES[s.marketplace]?.split(' ')[0] || s.marketplace,
      revenue: Math.round(s.totalRevenue / 1000),
      orders: s.ordersCount,
      products: s.productsCount,
      fill: CHART_COLORS[i % CHART_COLORS.length],
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

    // Daily revenue trend (last 30 days)
    const dailyMap = new Map<string, number>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().split('T')[0], 0);
    }
    connectedMarketplaces.forEach(mp => {
      store.getOrders(mp)
        .filter(o => !['CANCELLED', 'RETURNED'].includes(o.status))
        .forEach(o => {
          const day = new Date(o.createdAt).toISOString().split('T')[0];
          if (dailyMap.has(day)) {
            dailyMap.set(day, (dailyMap.get(day) || 0) + toDisplayUzs(o.total || 0, mp));
          }
        });
    });
    const dailyRevenue = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
      date: date.slice(5), // MM-DD
      revenue: Math.round(revenue / 1000),
    }));

    // Top products by revenue
    const productRevMap = new Map<string, { name: string; revenue: number; orders: number; marketplace: string; image?: string }>();
    connectedMarketplaces.forEach(mp => {
      // Build product lookup from store for real names/images
      const productLookup = new Map<string, { name: string; image?: string }>();
      store.getProducts(mp).forEach((p: any) => {
        if (p.offerId) productLookup.set(p.offerId, { name: p.name || p.offerId, image: p.pictures?.[0] || p.photo || p.images?.[0] });
        if (p.shopSku) productLookup.set(p.shopSku, { name: p.name || p.shopSku, image: p.pictures?.[0] || p.photo || p.images?.[0] });
      });

      store.getOrders(mp)
        .filter(o => !['CANCELLED', 'RETURNED'].includes(o.status))
        .forEach(o => {
          (o.items || []).forEach((item: any) => {
            const key = `${mp}:${item.offerId}`;
            const lookup = productLookup.get(item.offerId) || productLookup.get(item.name);
            const realName = lookup?.name || item.name || item.offerId;
            const image = lookup?.image;
            const existing = productRevMap.get(key) || { name: realName, revenue: 0, orders: 0, marketplace: mp, image };
            existing.revenue += toDisplayUzs((item.price || 0) * (item.count || 1), mp);
            existing.orders += item.count || 1;
            if (!existing.image && image) existing.image = image;
            productRevMap.set(key, existing);
          });
        });
    });
    const topProds = Array.from(productRevMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      stats: marketplaceStats,
      totals: { products: totalProducts, orders: totalOrders, revenue: totalRevenue, cancelled: totalCancelled },
      revenueChartData: revenueChart,
      orderStatusData: orderStatus,
      dailyRevenueData: dailyRevenue,
      topProducts: topProds,
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
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-2 text-primary mb-2">
              <DollarSign className="h-4 w-4 md:h-5 md:w-5" /><span className="text-xs md:text-sm font-medium">Jami daromad</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <><div className="text-xl md:text-2xl font-bold">{formatPrice(totals.revenue)}</div>
              <div className="text-xs text-muted-foreground mt-1">So'nggi 30 kun</div></>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" /><span className="text-xs md:text-sm font-medium">Buyurtmalar</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <><div className="text-xl md:text-2xl font-bold">{totals.orders}</div>
              <div className="text-xs text-muted-foreground mt-1">Bekor: {totals.cancelled} ({totals.orders > 0 ? ((totals.cancelled/totals.orders)*100).toFixed(1) : 0}%)</div></>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4 md:h-5 md:w-5" /><span className="text-xs md:text-sm font-medium">Mahsulotlar</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <><div className="text-xl md:text-2xl font-bold">{totals.products}</div>
              <div className="text-xs text-muted-foreground mt-1">Jami</div></>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-2 text-accent mb-2">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5" /><span className="text-xs md:text-sm font-medium">O'rtacha chek</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <><div className="text-xl md:text-2xl font-bold">
                {totals.orders > 0 ? formatPrice(Math.round(totals.revenue / totals.orders)) : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Buyurtma uchun</div></>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm md:text-base">Kunlik daromad trendi</CardTitle>
              <CardDescription className="text-xs">So'nggi 30 kun (ming so'm)</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${store.isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Yangilash</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-56 w-full" /> : dailyRevenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyRevenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} ming so'm`, 'Daromad']} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#revenueGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Ma'lumot yo'q</div>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by marketplace */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Marketplace bo'yicha daromad</CardTitle>
            <CardDescription className="text-xs">ming so'm</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-52 w-full" /> : revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueChartData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} ming so'm`, 'Daromad']} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueChartData.map((entry, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Ma'lumot yo'q</div>
            )}
          </CardContent>
        </Card>

        {/* Order status pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Buyurtma holatlari</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-52 w-full" /> : orderStatusData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={orderStatusData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                      {orderStatusData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {orderStatusData.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      <div>
                        <span className="text-sm text-foreground font-medium">{item.value}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{item.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Ma'lumot yo'q</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products Table */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm md:text-base">Top mahsulotlar</CardTitle>
                <CardDescription className="text-xs">Eng ko'p daromad keltirgan mahsulotlar</CardDescription>
              </div>
              <Badge variant="secondary">{topProducts.length} ta</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Mahsulot</TableHead>
                    <TableHead className="text-center">MP</TableHead>
                    <TableHead className="text-right">Sotilgan</TableHead>
                    <TableHead className="text-right">Daromad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {p.image ? (
                            <img src={p.image} alt="" className="h-9 w-9 rounded object-cover shrink-0 border" />
                          ) : (
                            <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="truncate max-w-[180px] md:max-w-[280px] font-medium text-sm">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <MarketplaceLogo marketplace={p.marketplace} size={18} />
                      </TableCell>
                      <TableCell className="text-right">{p.orders} dona</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatPrice(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Marketplace breakdown table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm md:text-base">Marketplace bo'yicha statistika</CardTitle>
              <CardDescription className="text-xs">Har bir marketplace uchun batafsil ko'rsatkichlar</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${store.isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Yangilash</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marketplace</TableHead>
                    <TableHead className="text-right">Mahsulotlar</TableHead>
                    <TableHead className="text-right">Buyurtmalar</TableHead>
                    <TableHead className="text-right">Bekor qilingan</TableHead>
                    <TableHead className="text-right">O'rtacha chek</TableHead>
                    <TableHead className="text-right">Daromad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map(stat => (
                    <TableRow key={stat.marketplace}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <MarketplaceLogo marketplace={stat.marketplace} size={22} />
                          <span className="font-medium">{MARKETPLACE_NAMES[stat.marketplace] || stat.marketplace}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{stat.productsCount}</TableCell>
                      <TableCell className="text-right">{stat.ordersCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={Number(stat.cancelRate) > 10 ? 'destructive' : 'secondary'} className="text-xs">
                          {stat.cancelRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.ordersCount > 0 ? formatPrice(Math.round(stat.totalRevenue / stat.ordersCount)) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatPrice(stat.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Jami</TableCell>
                    <TableCell className="text-right">{totals.products}</TableCell>
                    <TableCell className="text-right">{totals.orders}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {totals.orders > 0 ? ((totals.cancelled / totals.orders) * 100).toFixed(1) : 0}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {totals.orders > 0 ? formatPrice(Math.round(totals.revenue / totals.orders)) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-primary">{formatPrice(totals.revenue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
