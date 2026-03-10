import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle, Clock, Package, Search, TrendingDown, CheckCircle2, ArrowUpDown
} from 'lucide-react';
import { toDisplayUzs } from '@/lib/currency';
import { isExcludedOrder } from '@/lib/revenueCalculations';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo } from '@/lib/marketplaceConfig';
import type { MarketplaceDataStore, MarketplaceProduct, MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface ForecastItem {
  offerId: string;
  name: string;
  marketplace: string;
  photo?: string;
  currentStock: number;
  stockFBO: number;
  stockFBS: number;
  dailyVelocity: number;
  daysUntilStockout: number;
  last30Sales: number;
  last7Sales: number;
  urgency: 'critical' | 'warning' | 'ok' | 'safe';
}

type SortKey = 'daysUntilStockout' | 'dailyVelocity' | 'currentStock' | 'name';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));

export function StockForecast({ connectedMarketplaces, store }: Props) {
  const [selectedMp, setSelectedMp] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('daysUntilStockout');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  const isLoading = store.isLoadingProducts || store.isLoadingOrders;
  const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];

  const forecasts = useMemo(() => {
    if (isLoading) return [];
    const now = Date.now();
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    const result: ForecastItem[] = [];

    for (const mp of mpList) {
      const products = store.getProducts(mp);
      const orders = store.getOrders(mp);

      // Build sales velocity per SKU
      const salesMap30 = new Map<string, number>();
      const salesMap7 = new Map<string, number>();

      for (const order of orders) {
        if (isExcludedOrder(order)) continue;
        const orderTime = new Date(order.createdAt).getTime();
        for (const item of (order.items || [])) {
          const key = (item.offerId || '').toLowerCase();
          const qty = item.count || 1;
          if (now - orderTime <= ms30d) salesMap30.set(key, (salesMap30.get(key) || 0) + qty);
          if (now - orderTime <= ms7d) salesMap7.set(key, (salesMap7.get(key) || 0) + qty);
        }
      }

      for (const product of products) {
        const key = (product.offerId || '').toLowerCase();
        const stock = (product.stockFBO || 0) + (product.stockFBS || 0) + (product.stockCount || 0);
        const last30 = salesMap30.get(key) || 0;
        const last7 = salesMap7.get(key) || 0;
        
        // Use 7-day velocity if available (more recent), else 30-day
        const dailyVelocity = last7 > 0 ? last7 / 7 : last30 / 30;
        const daysUntilStockout = dailyVelocity > 0 ? stock / dailyVelocity : stock > 0 ? 999 : 0;

        let urgency: ForecastItem['urgency'] = 'safe';
        if (stock === 0 && dailyVelocity > 0) urgency = 'critical';
        else if (daysUntilStockout <= 3) urgency = 'critical';
        else if (daysUntilStockout <= 7) urgency = 'warning';
        else if (daysUntilStockout <= 14) urgency = 'ok';

        // Skip products with no sales and no stock
        if (stock === 0 && last30 === 0) continue;

        result.push({
          offerId: product.offerId,
          name: product.name,
          marketplace: mp,
          photo: product.pictures?.[0],
          currentStock: stock,
          stockFBO: product.stockFBO || 0,
          stockFBS: product.stockFBS || 0,
          dailyVelocity,
          daysUntilStockout: Math.round(daysUntilStockout),
          last30Sales: last30,
          last7Sales: last7,
          urgency,
        });
      }
    }

    return result;
  }, [mpList, store.dataVersion, isLoading]);

  const filtered = useMemo(() => {
    let arr = forecasts;
    if (urgencyFilter !== 'all') arr = arr.filter(f => f.urgency === urgencyFilter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(f => f.name.toLowerCase().includes(q) || f.offerId.toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });
    return arr;
  }, [forecasts, search, sortBy, sortDir, urgencyFilter]);

  const urgencyCounts = useMemo(() => {
    const c = { critical: 0, warning: 0, ok: 0, safe: 0 };
    forecasts.forEach(f => c[f.urgency]++);
    return c;
  }, [forecasts]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  if (connectedMarketplaces.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Avval marketplace ulang</CardContent></Card>;
  }

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;
  }

  const urgencyConfig = {
    critical: { label: 'Kritik', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30', icon: AlertTriangle },
    warning: { label: 'Ogohlantirish', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30', icon: Clock },
    ok: { label: 'Normal', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30', icon: Package },
    safe: { label: 'Xavfsiz', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  };

  return (
    <div className="space-y-4">
      <MarketplaceFilterBar connectedMarketplaces={connectedMarketplaces} selectedMp={selectedMp} onSelect={setSelectedMp} />

      {/* Urgency summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'warning', 'ok', 'safe'] as const).map(level => {
          const cfg = urgencyConfig[level];
          const Icon = cfg.icon;
          return (
            <Card key={level} className={`cursor-pointer transition-all ${urgencyFilter === level ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setUrgencyFilter(urgencyFilter === level ? 'all' : level)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold">{urgencyCounts[level]}</p>
                <p className="text-[10px] text-muted-foreground">
                  {level === 'critical' ? '≤3 kun' : level === 'warning' ? '4-7 kun' : level === 'ok' ? '8-14 kun' : '14+ kun'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="SKU yoki nomi bo'yicha qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Mahsulot</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('currentStock')}>
                  <span className="inline-flex items-center gap-1">Zaxira <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">FBO / FBS</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('dailyVelocity')}>
                  <span className="inline-flex items-center gap-1">Kunlik sotilish <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">7 kun / 30 kun</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('daysUntilStockout')}>
                  <span className="inline-flex items-center gap-1">Tugash <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Holat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(f => {
                const cfg = urgencyConfig[f.urgency];
                return (
                  <tr key={`${f.marketplace}:${f.offerId}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {f.photo ? (
                          <img src={f.photo} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[200px] lg:max-w-[300px]">{f.name}</p>
                          <div className="flex items-center gap-1.5">
                            <MarketplaceLogo marketplace={f.marketplace} size={12} />
                            <span className="text-[10px] text-muted-foreground">{f.offerId}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-3 font-medium">{fmt(f.currentStock)}</td>
                    <td className="text-right py-2.5 px-3 hidden md:table-cell text-xs text-muted-foreground">
                      {f.stockFBO > 0 && <span className="mr-1">FBO:{f.stockFBO}</span>}
                      {f.stockFBS > 0 && <span>FBS:{f.stockFBS}</span>}
                    </td>
                    <td className="text-right py-2.5 px-3 font-medium">{f.dailyVelocity.toFixed(1)}</td>
                    <td className="text-right py-2.5 px-3 hidden md:table-cell text-xs text-muted-foreground">
                      {f.last7Sales} / {f.last30Sales}
                    </td>
                    <td className="text-right py-2.5 px-3">
                      <span className={`font-bold ${cfg.color}`}>
                        {f.daysUntilStockout >= 999 ? '∞' : f.daysUntilStockout + ' kun'}
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <Badge variant="outline" className={`text-[10px] ${cfg.bg} ${cfg.color} border`}>
                        {cfg.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Ma'lumot topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
