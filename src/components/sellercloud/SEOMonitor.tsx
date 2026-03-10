import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Search, TrendingUp, TrendingDown, Hash, Eye, ShoppingCart,
  ArrowUpDown, RefreshCw, AlertTriangle, BarChart3, Target
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo } from '@/lib/marketplaceConfig';
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
  conversionRate: number;
}

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));

export function SEOMonitor({ connectedMarketplaces, store }: Props) {
  const [selectedMp, setSelectedMp] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('products');
  const [period, setPeriod] = useState(7);

  const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];
  const hasWB = mpList.includes('wildberries');

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

  // Build product-level SEO metrics
  const productSEOData = useMemo(() => {
    const products = store.getProducts('wildberries');
    if (!wbData?.keywords?.length) {
      // Create entries from products even without keyword data
      return products.map(p => ({
        offerId: p.offerId,
        name: p.name,
        marketplace: 'wildberries',
        photo: p.pictures?.[0],
        topKeywords: [],
        avgPosition: 0,
        totalClicks: 0,
        totalOrders: 0,
        conversionRate: 0,
      }));
    }

    const map = new Map<string, ProductSEO>();
    
    // Map keywords to products
    for (const kw of (wbData.keywords || [])) {
      const productId = kw.nmId || kw.nmID;
      if (!productId) continue;
      
      const product = products.find(p => 
        String((p as any).nmId || (p as any).nmID) === String(productId)
      );
      if (!product) continue;
      
      const key = product.offerId;
      if (!map.has(key)) {
        map.set(key, {
          offerId: product.offerId,
          name: product.name,
          marketplace: 'wildberries',
          photo: product.pictures?.[0],
          topKeywords: [],
          avgPosition: 0,
          totalClicks: 0,
          totalOrders: 0,
          conversionRate: 0,
        });
      }

      const entry = map.get(key)!;
      entry.topKeywords.push({
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

    // Calculate aggregates
    map.forEach(p => {
      p.topKeywords.sort((a, b) => b.frequency - a.frequency);
      p.totalClicks = p.topKeywords.reduce((s, k) => s + k.clicks, 0);
      p.totalOrders = p.topKeywords.reduce((s, k) => s + k.orders, 0);
      p.avgPosition = p.topKeywords.length > 0
        ? p.topKeywords.reduce((s, k) => s + k.position, 0) / p.topKeywords.length
        : 0;
      p.conversionRate = p.totalClicks > 0 ? (p.totalOrders / p.totalClicks) * 100 : 0;
    });

    return Array.from(map.values());
  }, [wbData, store.dataVersion]);

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

  const filteredProducts = useMemo(() => {
    if (!search) return productSEOData;
    const q = search.toLowerCase();
    return productSEOData.filter(p => p.name.toLowerCase().includes(q) || p.offerId.toLowerCase().includes(q));
  }, [productSEOData, search]);

  const filteredKeywords = useMemo(() => {
    if (!search) return allKeywords;
    const q = search.toLowerCase();
    return allKeywords.filter(k => k.keyword.includes(q));
  }, [allKeywords, search]);

  if (connectedMarketplaces.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Avval marketplace ulang</CardContent></Card>;
  }

  if (!hasWB) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">SEO Monitor</h3>
          <p className="text-muted-foreground mb-4">Hozircha faqat Wildberries uchun mavjud. WB marketplace ulang.</p>
          <Badge variant="outline">Yandex va Uzum — tez kunda</Badge>
        </CardContent>
      </Card>
    );
  }

  const isLoading = wbLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <MarketplaceFilterBar connectedMarketplaces={connectedMarketplaces} selectedMp={selectedMp} onSelect={setSelectedMp} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                {d} kun
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Hash className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Kalit so'zlar</span></div>
            <p className="text-2xl font-bold">{allKeywords.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Eye className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Jami ko'rishlar</span></div>
            <p className="text-2xl font-bold">{fmt(allKeywords.reduce((s, k) => s + k.clicks, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Buyurtmalar</span></div>
            <p className="text-2xl font-bold">{fmt(allKeywords.reduce((s, k) => s + k.orders, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">O'rtacha pozitsiya</span></div>
            <p className="text-2xl font-bold">
              {allKeywords.length > 0 ? (allKeywords.reduce((s, k) => s + k.position, 0) / allKeywords.length).toFixed(0) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="products">Mahsulotlar bo'yicha</TabsTrigger>
          <TabsTrigger value="keywords">Kalit so'zlar</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {isLoading ? <Skeleton className="h-96" /> : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Mahsulot</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">O'rt. pozitsiya</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Ko'rishlar</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Buyurtmalar</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Konversiya</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground hidden lg:table-cell">Top kalit so'zlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.filter(p => p.topKeywords.length > 0).slice(0, 50).map(p => (
                      <tr key={p.offerId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {p.photo ? <img src={p.photo} alt="" className="w-8 h-8 rounded object-cover shrink-0" /> :
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0"><BarChart3 className="h-4 w-4 text-muted-foreground" /></div>}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[200px]">{p.name}</p>
                              <span className="text-[10px] text-muted-foreground">{p.offerId}</span>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-2.5 px-3 font-bold">{p.avgPosition > 0 ? p.avgPosition.toFixed(0) : '—'}</td>
                        <td className="text-right py-2.5 px-3">{fmt(p.totalClicks)}</td>
                        <td className="text-right py-2.5 px-3">{fmt(p.totalOrders)}</td>
                        <td className="text-right py-2.5 px-3">
                          <Badge variant={p.conversionRate >= 5 ? 'default' : p.conversionRate >= 2 ? 'secondary' : 'outline'}>
                            {p.conversionRate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {p.topKeywords.slice(0, 3).map((k, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5">{k.keyword}</Badge>
                            ))}
                            {p.topKeywords.length > 3 && <span className="text-[10px] text-muted-foreground">+{p.topKeywords.length - 3}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.filter(p => p.topKeywords.length > 0).length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">
                        {wbData ? 'SEO ma\'lumotlari topilmadi. WB Jam obunasi kerak bo\'lishi mumkin.' : 'Ma\'lumot yuklanmoqda...'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="keywords">
          {isLoading ? <Skeleton className="h-96" /> : (
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
          )}
        </TabsContent>
      </Tabs>

      {/* WB Jam warning */}
      {hasWB && !wbData?.keywords?.length && !isLoading && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">WB Jam obunasi kerak</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kalit so'z analitikasi uchun Wildberries shaxsiy kabinetida "WB Jam" obunasini faollashtiring. 
                  Obunasiz API 403 xatolik qaytaradi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
