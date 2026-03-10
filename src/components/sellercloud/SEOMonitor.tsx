import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Search, TrendingUp, TrendingDown, Hash, Eye, ShoppingCart,
  ArrowUpDown, RefreshCw, AlertTriangle, BarChart3, Target, Package
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo, MARKETPLACE_NAMES } from '@/lib/marketplaceConfig';
import { isExcludedOrder } from '@/lib/revenueCalculations';
import { toDisplayUzs } from '@/lib/currency';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface KeywordData {
  keyword: string;
  frequency: number;
  position: number;
  positionChange: number;
  clicks: number;
  orders: number;
  ctr: number;
  marketplace: string;
}

interface ProductSEO {
  offerId: string;
  name: string;
  marketplace: string;
  photo?: string;
  topKeywords: KeywordData[];
  avgPosition: number;
  totalClicks: number;
  totalOrders: number;
  unitsSold: number;
  revenue: number;
  conversionRate: number;
  stockCount: number;
  hasKeywordData: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));

export function SEOMonitor({ connectedMarketplaces, store }: Props) {
  const [selectedMp, setSelectedMp] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('products');
  const [period, setPeriod] = useState(7);
  const [sortBy, setSortBy] = useState<'unitsSold' | 'revenue' | 'avgPosition' | 'conversionRate'>('unitsSold');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];
  const hasWB = mpList.includes('wildberries');

  // WB keyword data (optional enhancement)
  const { data: wbData, isLoading: wbLoading, refetch, isFetching } = useQuery({
    queryKey: ['seo-monitor-wb', period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: 'wildberries', dataType: 'search-queries', period },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasWB,
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  // Build product-level SEO metrics from ALL marketplaces
  const productSEOData = useMemo(() => {
    const now = Date.now();
    const periodMs = period * 24 * 60 * 60 * 1000;
    const result: ProductSEO[] = [];

    // Build WB keyword map
    const wbKeywordMap = new Map<string, KeywordData[]>();
    if (wbData?.keywords?.length) {
      for (const kw of wbData.keywords) {
        const productId = String(kw.nmId || kw.nmID || '');
        if (!productId) continue;
        if (!wbKeywordMap.has(productId)) wbKeywordMap.set(productId, []);
        wbKeywordMap.get(productId)!.push({
          keyword: kw.keyword || kw.text || '',
          frequency: kw.frequency || kw.count || 0,
          position: kw.avgPosition || kw.position || 0,
          positionChange: kw.positionChange || 0,
          clicks: kw.openCardCount || kw.clicks || 0,
          orders: kw.addToCartCount || kw.orders || 0,
          ctr: kw.ctr || 0,
          marketplace: 'wildberries',
        });
      }
    }

    for (const mp of mpList) {
      const products = store.getProducts(mp);
      const orders = store.getOrders(mp);

      // Build sales per SKU for the period
      const salesMap = new Map<string, { units: number; revenue: number }>();
      for (const order of orders) {
        if (isExcludedOrder(order)) continue;
        const orderTime = new Date(order.createdAt).getTime();
        if (now - orderTime > periodMs) continue;
        for (const item of (order.items || [])) {
          const key = (item.offerId || '').toLowerCase();
          const qty = item.count || 1;
          const price = toDisplayUzs(item.price || 0, mp);
          const prev = salesMap.get(key) || { units: 0, revenue: 0 };
          salesMap.set(key, { units: prev.units + qty, revenue: prev.revenue + price * qty });
        }
      }

      for (const product of products) {
        const key = (product.offerId || '').toLowerCase();
        const sales = salesMap.get(key) || { units: 0, revenue: 0 };
        const stock = (product.stockFBO || 0) + (product.stockFBS || 0) + (product.stockCount || 0);

        // Get WB keywords if available
        const nmId = String((product as any).nmId || (product as any).nmID || '');
        const keywords = (mp === 'wildberries' && nmId) ? (wbKeywordMap.get(nmId) || []) : [];
        keywords.sort((a, b) => b.frequency - a.frequency);

        const totalClicks = keywords.reduce((s, k) => s + k.clicks, 0);
        const totalKwOrders = keywords.reduce((s, k) => s + k.orders, 0);
        const avgPos = keywords.length > 0
          ? keywords.reduce((s, k) => s + k.position, 0) / keywords.length : 0;

        // Skip products with no sales, no stock, no keywords
        if (sales.units === 0 && stock === 0 && keywords.length === 0) continue;

        result.push({
          offerId: product.offerId,
          name: product.name,
          marketplace: mp,
          photo: product.pictures?.[0],
          topKeywords: keywords,
          avgPosition: avgPos,
          totalClicks,
          totalOrders: totalKwOrders,
          unitsSold: sales.units,
          revenue: sales.revenue,
          conversionRate: totalClicks > 0 ? (totalKwOrders / totalClicks) * 100 : (sales.units > 0 ? -1 : 0),
          stockCount: stock,
          hasKeywordData: keywords.length > 0,
        });
      }
    }

    return result;
  }, [mpList, wbData, store.dataVersion, period]);

  // All keywords aggregated
  const allKeywords = useMemo(() => {
    if (!wbData?.keywords?.length) return [];
    const kwMap = new Map<string, KeywordData>();
    for (const kw of wbData.keywords) {
      const text = (kw.keyword || kw.text || '').toLowerCase().trim();
      if (!text) continue;
      if (!kwMap.has(text)) {
        kwMap.set(text, {
          keyword: text,
          frequency: kw.frequency || kw.count || 0,
          position: kw.avgPosition || kw.position || 0,
          positionChange: kw.positionChange || 0,
          clicks: kw.openCardCount || kw.clicks || 0,
          orders: kw.addToCartCount || kw.orders || 0,
          ctr: kw.ctr || 0,
          marketplace: 'wildberries',
        });
      } else {
        const existing = kwMap.get(text)!;
        existing.clicks += kw.openCardCount || kw.clicks || 0;
        existing.orders += kw.addToCartCount || kw.orders || 0;
      }
    }
    return Array.from(kwMap.values()).sort((a, b) => b.frequency - a.frequency);
  }, [wbData]);

  const filtered = useMemo(() => {
    let arr = productSEOData;
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(p => p.name.toLowerCase().includes(q) || p.offerId.toLowerCase().includes(q));
    }
    arr = [...arr].sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });
    return arr;
  }, [productSEOData, search, sortBy, sortDir]);

  const filteredKeywords = useMemo(() => {
    if (!search) return allKeywords;
    const q = search.toLowerCase();
    return allKeywords.filter(k => k.keyword.includes(q));
  }, [allKeywords, search]);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  // Summary stats
  const stats = useMemo(() => ({
    totalProducts: productSEOData.length,
    totalSold: productSEOData.reduce((s, p) => s + p.unitsSold, 0),
    totalRevenue: productSEOData.reduce((s, p) => s + p.revenue, 0),
    withKeywords: productSEOData.filter(p => p.hasKeywordData).length,
    avgPosition: allKeywords.length > 0
      ? allKeywords.reduce((s, k) => s + k.position, 0) / allKeywords.length : 0,
    totalKeywords: allKeywords.length,
  }), [productSEOData, allKeywords]);

  if (connectedMarketplaces.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Avval marketplace ulang</CardContent></Card>;
  }

  const isLoading = store.isLoadingProducts || store.isLoadingOrders;

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <MarketplaceFilterBar connectedMarketplaces={connectedMarketplaces} selectedMp={selectedMp} onSelect={setSelectedMp} />
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                {d} kun
              </button>
            ))}
          </div>
          {hasWB && (
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Mahsulotlar</span></div>
            <p className="text-2xl font-bold">{stats.totalProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">{period} kunda sotilgan</span></div>
            <p className="text-2xl font-bold">{fmt(stats.totalSold)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Daromad</span></div>
            <p className="text-2xl font-bold">{fmt(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Hash className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">WB kalit so'zlar</span></div>
            <p className="text-2xl font-bold">{stats.totalKeywords}</p>
            {stats.avgPosition > 0 && <p className="text-[10px] text-muted-foreground">O'rt. pozitsiya: {stats.avgPosition.toFixed(0)}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="products">Mahsulotlar ({filtered.length})</TabsTrigger>
          {allKeywords.length > 0 && <TabsTrigger value="keywords">Kalit so'zlar ({allKeywords.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="products">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Mahsulot</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('unitsSold')}>
                      <span className="inline-flex items-center gap-1">Sotilgan <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('revenue')}>
                      <span className="inline-flex items-center gap-1">Daromad <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Zaxira</th>
                    {hasWB && (
                      <>
                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => toggleSort('avgPosition')}>
                          <span className="inline-flex items-center gap-1">Pozitsiya <ArrowUpDown className="h-3 w-3" /></span>
                        </th>
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden xl:table-cell">Top kalit so'zlar</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map(p => (
                    <tr key={`${p.marketplace}:${p.offerId}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {p.photo ? <img src={p.photo} alt="" className="w-8 h-8 rounded object-cover shrink-0" /> :
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0"><BarChart3 className="h-4 w-4 text-muted-foreground" /></div>}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[200px]">{p.name}</p>
                            <div className="flex items-center gap-1.5">
                              <MarketplaceLogo marketplace={p.marketplace} size={12} />
                              <span className="text-[10px] text-muted-foreground">{p.offerId}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-3 font-bold">{fmt(p.unitsSold)}</td>
                      <td className="text-right py-2.5 px-3">{fmt(p.revenue)}</td>
                      <td className="text-right py-2.5 px-3 hidden md:table-cell">
                        <Badge variant={p.stockCount === 0 ? 'destructive' : p.stockCount < 10 ? 'secondary' : 'outline'} className="text-[10px]">
                          {p.stockCount}
                        </Badge>
                      </td>
                      {hasWB && (
                        <>
                          <td className="text-right py-2.5 px-3 hidden lg:table-cell font-bold">
                            {p.avgPosition > 0 ? p.avgPosition.toFixed(0) : '—'}
                          </td>
                          <td className="py-2.5 px-3 hidden xl:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {p.topKeywords.slice(0, 3).map((k, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5">{k.keyword}</Badge>
                              ))}
                              {p.topKeywords.length > 3 && <span className="text-[10px] text-muted-foreground">+{p.topKeywords.length - 3}</span>}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={hasWB ? 6 : 4} className="py-8 text-center text-muted-foreground">Ma'lumot topilmadi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 100 && (
              <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground text-center">
                Birinchi 100 ta ko'rsatilmoqda (jami: {filtered.length})
              </div>
            )}
          </Card>
        </TabsContent>

        {allKeywords.length > 0 && (
          <TabsContent value="keywords">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Kalit so'z</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Chastota</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Pozitsiya</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">O'zgarish</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Ko'rishlar</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Buyurtmalar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeywords.slice(0, 100).map((k, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{k.keyword}</td>
                        <td className="text-right py-2.5 px-3">{fmt(k.frequency)}</td>
                        <td className="text-right py-2.5 px-3 font-bold">{k.position > 0 ? k.position.toFixed(0) : '—'}</td>
                        <td className="text-right py-2.5 px-3">
                          {k.positionChange !== 0 && (
                            <span className={`inline-flex items-center gap-0.5 text-xs ${k.positionChange < 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                              {k.positionChange < 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {Math.abs(k.positionChange)}
                            </span>
                          )}
                        </td>
                        <td className="text-right py-2.5 px-3">{fmt(k.clicks)}</td>
                        <td className="text-right py-2.5 px-3">{fmt(k.orders)}</td>
                      </tr>
                    ))}
                    {filteredKeywords.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Kalit so'zlar topilmadi</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Info banner for non-WB marketplaces */}
      {!hasWB && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Search className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Kalit so'z analitikasi</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kalit so'z pozitsiyasi va qidiruv chastotasi hozircha faqat Wildberries (WB Jam obunasi) orqali mavjud.
                  Boshqa marketplace'lar uchun sotuvlar va zaxira ko'rsatkichlari ko'rsatilmoqda.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WB Jam warning */}
      {hasWB && !wbData?.keywords?.length && !wbLoading && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">WB Jam obunasi kerak</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kalit so'z analitikasi uchun Wildberries shaxsiy kabinetida "WB Jam" obunasini faollashtiring.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
