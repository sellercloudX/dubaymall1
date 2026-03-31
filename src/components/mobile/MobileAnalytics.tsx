import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Package, ShoppingCart, Globe, AlertTriangle, Wallet, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { MarketplaceLogo } from '@/lib/marketplaceConfig';
import { toDisplayUzs } from '@/lib/currency';
import { getOrderRevenueUzs, isExcludedOrder, buildOrderMarketplaceMap } from '@/lib/revenueCalculations';
import { getMarketplaceOrderStatusCategory } from '@/lib/marketplaceOrderStatus';

interface MobileAnalyticsProps {
  connections: any[];
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

export function MobileAnalytics({ connections, connectedMarketplaces, store }: MobileAnalyticsProps) {
  const isLoading = store.isLoading;

  const stats = useMemo(() => {
    const allProducts = store.allProducts;
    const allOrders = store.allOrders;
    const totalProducts = allProducts.length;
    const totalOrders = allOrders.length;
    
    // Build order→marketplace map for efficient currency conversion
    const orderMpMap = buildOrderMarketplaceMap(store.getOrders, connectedMarketplaces);
    
    const validOrders = allOrders.filter(o => !isExcludedOrder(o));
    const totalRevenue = validOrders.reduce((sum, o) => {
      return sum + getOrderRevenueUzs(o, orderMpMap.get(o.id) || '');
    }, 0);
    const avgCheck = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
    const pendingOrders = allOrders.filter(o => {
      const mp = orderMpMap.get(o.id) || '';
      return getMarketplaceOrderStatusCategory(o, mp) === 'new';
    }).length;
    const processingOrders = allOrders.filter(o => {
      const mp = orderMpMap.get(o.id) || '';
      const cat = getMarketplaceOrderStatusCategory(o, mp);
      return cat === 'assembly' || cat === 'active';
    }).length;
    const deliveredOrders = allOrders.filter(o => {
      const mp = orderMpMap.get(o.id) || '';
      return getMarketplaceOrderStatusCategory(o, mp) === 'delivered';
    }).length;
    const cancelledOrders = allOrders.filter(o => {
      const mp = orderMpMap.get(o.id) || '';
      return getMarketplaceOrderStatusCategory(o, mp) === 'cancelled';
    }).length;
    const lowStockProducts = allProducts.filter(p => (p.stockCount || 0) > 0 && (p.stockCount || 0) < 5).length;
    const outOfStockProducts = allProducts.filter(p => (p.stockCount || 0) === 0).length;

    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    allOrders.forEach(order => {
      if (['CANCELLED', 'RETURNED'].includes(order.status)) return;
      const mp = orderMpMap.get(order.id) || '';
      order.items?.forEach(item => {
        const existing = productSales.get(item.offerId) || { name: item.offerName || '', quantity: 0, revenue: 0 };
        existing.quantity += item.count || 1;
        existing.revenue += toDisplayUzs(item.price || 0, mp) * (item.count || 1);
        productSales.set(item.offerId, existing);
      });
    });
    const topProducts = Array.from(productSales.entries())
      .map(([offerId, data]) => ({ offerId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { totalProducts, totalOrders, totalRevenue, avgCheck, pendingOrders, processingOrders, deliveredOrders, cancelledOrders, lowStockProducts, outOfStockProducts, topProducts };
  }, [store.dataVersion, connectedMarketplaces]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    if (price >= 1000) return (price / 1000).toFixed(0) + ' ming';
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Globe className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-semibold text-base mb-1">Marketplace ulanmagan</h3>
        <p className="text-sm text-muted-foreground text-center">Analitikani ko'rish uchun marketplace ulang</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4 overflow-x-hidden">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          icon={DollarSign}
          label="Daromad"
          value={isLoading ? null : formatPrice(stats.totalRevenue)}
          suffix="so'm"
          className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
          iconClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={Wallet}
          label="O'rtacha chek"
          value={isLoading ? null : stats.avgCheck > 0 ? formatPrice(stats.avgCheck) : '—'}
          suffix="so'm"
          className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20"
          iconClass="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={ShoppingCart}
          label="Buyurtmalar"
          value={isLoading ? null : String(stats.totalOrders)}
          suffix="ta"
          className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20"
          iconClass="text-violet-600 dark:text-violet-400"
        />
        <StatCard
          icon={Package}
          label="Mahsulotlar"
          value={isLoading ? null : String(stats.totalProducts)}
          suffix="ta"
          className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20"
          iconClass="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Stock alert */}
      {(stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-destructive/8 border border-destructive/20">
          <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Zaxira ogohlantirishi</div>
            <div className="text-xs text-muted-foreground">
              {stats.outOfStockProducts > 0 && <span className="text-destructive font-medium">{stats.outOfStockProducts} tugagan</span>}
              {stats.outOfStockProducts > 0 && stats.lowStockProducts > 0 && ' · '}
              {stats.lowStockProducts > 0 && <span>{stats.lowStockProducts} kam qolgan</span>}
            </div>
          </div>
        </div>
      )}

      {/* Order statuses */}
      {stats.totalOrders > 0 && (
        <div>
          <SectionTitle>Buyurtma holatlari</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Kutilmoqda" value={stats.pendingOrders} color="text-amber-600 dark:text-amber-400" />
            <MiniStat label="Jarayonda" value={stats.processingOrders} color="text-blue-600 dark:text-blue-400" />
            <MiniStat label="Yetkazildi" value={stats.deliveredOrders} color="text-emerald-600 dark:text-emerald-400" />
            <MiniStat label="Bekor" value={stats.cancelledOrders} color="text-destructive" />
          </div>
        </div>
      )}

      {/* Top products */}
      {stats.topProducts.length > 0 && (
        <div>
          <SectionTitle icon={TrendingUp}>Top mahsulotlar</SectionTitle>
          <div className="space-y-2">
            {stats.topProducts.slice(0, 3).map((product, idx) => (
              <div key={product.offerId} className="flex items-center gap-3 p-3 rounded-2xl bg-card border">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-1">{product.name || "Noma'lum"}</div>
                  <div className="text-[11px] text-muted-foreground">{product.quantity} dona</div>
                </div>
                <div className="font-bold text-sm text-primary shrink-0">{formatPrice(product.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected marketplaces */}
      {connectedMarketplaces.length > 0 && (
        <div>
          <SectionTitle>Marketplacelar</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {connectedMarketplaces.map(mp => (
              <div key={mp} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/80 text-xs font-medium capitalize">
                <MarketplaceLogo marketplace={mp} size={14} /> {mp}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
const SectionTitle = React.forwardRef<HTMLDivElement, { children: React.ReactNode; icon?: React.ElementType }>(
  ({ children, icon: Icon }, ref) => (
    <div ref={ref} className="flex items-center gap-1.5 mb-2.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</h3>
    </div>
  )
);
SectionTitle.displayName = 'SectionTitle';

function StatCard({ icon: Icon, label, value, suffix, className, iconClass }: {
  icon: React.ElementType; label: string; value: string | null; suffix?: string; className?: string; iconClass?: string;
}) {
  return (
    <div className={`p-3.5 rounded-2xl border ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      {value === null ? <Skeleton className="h-7 w-20" /> : (
        <div className="text-xl font-bold tracking-tight">
          {value}
          {suffix && <span className="text-[10px] font-normal text-muted-foreground ml-1">{suffix}</span>}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2 rounded-xl bg-muted/50">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</div>
    </div>
  );
}
