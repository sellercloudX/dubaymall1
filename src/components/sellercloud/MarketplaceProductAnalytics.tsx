import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, Eye, ShoppingCart, Package, TrendingUp, TrendingDown,
  RefreshCw, ArrowRight, Search, ArrowUpDown, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toDisplayUzs } from '@/lib/currency';
import { rubToUzs, formatUzs } from '@/lib/currency';
import { isExcludedOrder, getOrderRevenueUzs } from '@/lib/revenueCalculations';
import { useQuery } from '@tanstack/react-query';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo } from '@/lib/marketplaceConfig';
import { DateRangeFilter, getPresetDates, type DatePreset } from './DateRangeFilter';
import type { MarketplaceDataStore, MarketplaceProduct, MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface ProductPerformance {
  offerId: string;
  name: string;
  marketplace: string;
  photo?: string;
  views: number;
  addToCart: number;
  orders: number;
  ordersSom: number;
  unitsSold: number;
  convToCart: number;
  convToOrder: number;
  avgOrderValue: number;
  // WB-specific (from API)
  wbViews?: number;
  wbAddToCart?: number;
  wbBuyouts?: number;
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
const fmtPrice = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";

type SortKey = 'unitsSold' | 'ordersSom' | 'convToCart' | 'convToOrder';

export function MarketplaceProductAnalytics({ connectedMarketplaces, store }: Props) {
  const [selectedMp, setSelectedMp] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(getPresetDates('30d').from);
  const [dateTo, setDateTo] = useState<Date | undefined>(getPresetDates('30d').to);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('ordersSom');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [period, setPeriod] = useState(7);

  const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];
  const hasWB = mpList.includes('wildberries');
  const isLoading = store.isLoadingOrders || store.isLoadingProducts;

  // WB-specific detailed analytics (optional enhancement)
  const { data: wbData, isLoading: wbLoading } = useQuery({
    queryKey: ['wb-seller-analytics-universal', period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: 'wildberries', dataType: 'seller-analytics', period },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasWB,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Build universal product analytics from order data
  const productAnalytics = useMemo(() => {
    if (isLoading) return [];
    const map = new Map<string, ProductPerformance>();

    for (const mp of mpList) {
      const products = store.getProducts(mp);
      // Initialize from product catalog
      for (const p of products) {
        const key = `${mp}:${p.offerId.toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            offerId: p.offerId,
            name: p.name,
            marketplace: mp,
            photo: p.pictures?.[0],
            views: 0, addToCart: 0, orders: 0, ordersSom: 0,
            unitsSold: 0, convToCart: 0, convToOrder: 0, avgOrderValue: 0,
          });
        }
      }

      // Aggregate from orders
      const orders = store.getOrders(mp);
      for (const order of orders) {
        if (isExcludedOrder(order)) continue;
        if (dateFrom || dateTo) {
          const d = new Date(order.createdAt);
          if (dateFrom && d < dateFrom) continue;
          if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); if (d > end) continue; }
        }
        for (const item of (order.items || [])) {
          const key = `${mp}:${(item.offerId || '').toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, {
              offerId: item.offerId,
              name: item.offerName || item.offerId,
              marketplace: mp,
              photo: item.photo,
              views: 0, addToCart: 0, orders: 0, ordersSom: 0,
              unitsSold: 0, convToCart: 0, convToOrder: 0, avgOrderValue: 0,
            });
          }
          const entry = map.get(key)!;
          entry.orders++;
          entry.unitsSold += item.count || 1;
          entry.ordersSom += toDisplayUzs(item.price || 0, mp) * (item.count || 1);
        }
      }
    }

    // Enrich with WB analytics data if available
    if (hasWB && wbData?.data) {
      for (const card of wbData.data) {
        const vendorCode = card.vendorCode || '';
        const key = `wildberries:${vendorCode.toLowerCase()}`;
        if (map.has(key)) {
          const entry = map.get(key)!;
          entry.views = card.openCardCount || 0;
          entry.addToCart = card.addToCartCount || 0;
          entry.wbViews = card.openCardCount;
          entry.wbAddToCart = card.addToCartCount;
          entry.wbBuyouts = card.buyoutsCount;
          if (!entry.photo && card.photo) entry.photo = card.photo;
        }
      }
    }

    // Calculate conversion rates
    const result: ProductPerformance[] = [];
    map.forEach(p => {
      if (p.unitsSold === 0 && p.views === 0) return; // Skip inactive
      p.convToCart = p.views > 0 ? (p.addToCart / p.views) * 100 : 0;
      p.convToOrder = p.views > 0 ? (p.orders / p.views) * 100 : p.addToCart > 0 ? (p.orders / p.addToCart) * 100 : 0;
      p.avgOrderValue = p.orders > 0 ? p.ordersSom / p.orders : 0;
      result.push(p);
    });

    return result;
  }, [mpList, store.dataVersion, isLoading, wbData, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let arr = productAnalytics;
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(p => p.name.toLowerCase().includes(q) || p.offerId.toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });
    return arr;
  }, [productAnalytics, search, sortBy, sortDir]);

  // Summary totals
  const totals = useMemo(() => {
    const t = { views: 0, addToCart: 0, orders: 0, ordersSom: 0, unitsSold: 0, products: 0 };
    productAnalytics.forEach(p => {
      t.views += p.views; t.addToCart += p.addToCart;
      t.orders += p.orders; t.ordersSom += p.ordersSom;
      t.unitsSold += p.unitsSold; t.products++;
    });
    return { ...t, convToCart: t.views > 0 ? (t.addToCart / t.views) * 100 : 0, convToOrder: t.views > 0 ? (t.orders / t.views) * 100 : 0 };
  }, [productAnalytics]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  if (connectedMarketplaces.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Avval marketplace ulang</CardContent></Card>;
  }

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <MarketplaceFilterBar connectedMarketplaces={connectedMarketplaces} selectedMp={selectedMp} onSelect={setSelectedMp} />
        <div className="flex items-center gap-2">
          <DateRangeFilter from={dateFrom} to={dateTo} activePreset={datePreset}
            onRangeChange={(f, t, p) => { setDateFrom(f); setDateTo(t); setDatePreset(p); }} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Mahsulotlar</span></div>
            <p className="text-2xl font-bold">{totals.products}</p>
            <p className="text-xs text-muted-foreground">{fmt(totals.unitsSold)} dona sotildi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Eye className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Ko'rishlar</span></div>
            <p className="text-2xl font-bold">{fmt(totals.views)}</p>
            {totals.views > 0 && <p className="text-xs text-muted-foreground">Savatga: {totals.convToCart.toFixed(1)}%</p>}
            {totals.views === 0 && <p className="text-[10px] text-muted-foreground">WB Jam kerak</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Buyurtmalar</span></div>
            <p className="text-2xl font-bold">{fmt(totals.orders)}</p>
            {totals.views > 0 && <p className="text-xs text-muted-foreground">Konversiya: {totals.convToOrder.toFixed(1)}%</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Daromad</span></div>
            <p className="text-lg font-bold">{fmtPrice(totals.ordersSom)}</p>
            {totals.orders > 0 && <p className="text-xs text-muted-foreground">O'rt: {fmtPrice(totals.ordersSom / totals.orders)}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Conversion funnel (only if views available) */}
      {totals.views > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Konversiya funnel</p>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="font-bold">{fmt(totals.views)}</span>
                <span className="text-xs text-muted-foreground">ko'rish</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4 text-amber-500" />
                <span className="font-bold">{fmt(totals.addToCart)}</span>
                <Badge variant="secondary" className="text-[10px]">{totals.convToCart.toFixed(1)}%</Badge>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <Package className="h-4 w-4 text-emerald-500" />
                <span className="font-bold">{fmt(totals.orders)}</span>
                <Badge variant="secondary" className="text-[10px]">{totals.convToOrder.toFixed(1)}%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Mahsulot nomi yoki artikul..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Products table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Mahsulot</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden lg:table-cell">Ko'rishlar</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden lg:table-cell">Savatga</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('unitsSold')}>
                  <span className="inline-flex items-center gap-1">Sotilgan <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('ordersSom')}>
                  <span className="inline-flex items-center gap-1">Daromad <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden md:table-cell" onClick={() => toggleSort('convToCart')}>
                  <span className="inline-flex items-center gap-1">Conv % <ArrowUpDown className="h-3 w-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(p => (
                <tr key={`${p.marketplace}:${p.offerId}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p.photo ? <img src={p.photo} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[200px] lg:max-w-[300px]">{p.name}</p>
                        <div className="flex items-center gap-1.5">
                          <MarketplaceLogo marketplace={p.marketplace} size={12} />
                          <span className="text-[10px] text-muted-foreground">{p.offerId}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3 hidden lg:table-cell">{p.views > 0 ? fmt(p.views) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-right py-2.5 px-3 hidden lg:table-cell">{p.addToCart > 0 ? fmt(p.addToCart) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-right py-2.5 px-3 font-medium">{fmt(p.unitsSold)}</td>
                  <td className="text-right py-2.5 px-3 font-medium">{fmtPrice(p.ordersSom)}</td>
                  <td className="text-right py-2.5 px-3 hidden md:table-cell">
                    {p.views > 0 ? (
                      <Badge variant={p.convToCart >= 5 ? 'default' : p.convToCart >= 2 ? 'secondary' : 'outline'} className="text-xs">
                        {p.convToCart.toFixed(1)}%
                      </Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Ma'lumot topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground text-center">
            Birinchi 100 ta ({filtered.length} dan)
          </div>
        )}
      </Card>

      {/* Note about views data */}
      {totals.views === 0 && (
        <Card className="border-border bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">
              💡 Ko'rishlar va savatga qo'shish ma'lumotlari hozircha faqat Wildberries (WB Jam obunasi bilan) uchun mavjud. 
              Boshqa marketplacelar uchun buyurtmalar va daromad ko'rsatiladi.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
