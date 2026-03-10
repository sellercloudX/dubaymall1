import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, RefreshCw, TrendingUp, Hash, ShoppingCart, Eye, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface WBSearchKeywordsProps {
  connectedMarketplaces: string[];
}

type SortKey = 'frequency' | 'orders' | 'clicks' | 'position';

export function WBSearchKeywords({ connectedMarketplaces }: WBSearchKeywordsProps) {
  const [period, setPeriod] = useState(7);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('frequency');
  const [tab, setTab] = useState('keywords');
  const hasWB = connectedMarketplaces.includes('wildberries');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['wb-search-keywords', period],
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

  if (!hasWB) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          WB ulanmagan. Avval Wildberries marketplace ulang.
        </CardContent>
      </Card>
    );
  }

  if (data?.requiresJam) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="font-medium">WB Jam obunasi talab etiladi</p>
          <p className="text-sm text-muted-foreground mt-1">
            Qidiruv so'zlari statistikasi faqat WB Jam obunasi bilan ishlaydi.
          </p>
        </CardContent>
      </Card>
    );
  }

  const keywords = (data?.keywords || []).filter((k: any) =>
    !search || k.text.includes(search.toLowerCase())
  );

  const sorted = [...keywords].sort((a: any, b: any) => {
    if (sortBy === 'frequency') return b.totalFrequency - a.totalFrequency;
    if (sortBy === 'orders') return b.totalOrders - a.totalOrders;
    if (sortBy === 'clicks') return b.totalClicks - a.totalClicks;
    if (sortBy === 'position') return (a.avgPosition || 999) - (b.avgPosition || 999);
    return 0;
  });

  const productKeywords = data?.productKeywords || [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />WB Qidiruv so'zlari
        </h2>
        <div className="flex items-center gap-2">
          <Select value={String(period)} onValueChange={v => setPeriod(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 kun</SelectItem>
              <SelectItem value="14">14 kun</SelectItem>
              <SelectItem value="30">30 kun</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{summary.totalKeywords}</p>
              <p className="text-[10px] text-muted-foreground">Kalit so'zlar</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{summary.keywordsWithOrders}</p>
              <p className="text-[10px] text-muted-foreground">Buyurtmali</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{summary.totalSearchOrders}</p>
              <p className="text-[10px] text-muted-foreground">Qidiruvdan buyurtma</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="keywords" className="text-xs">
            <Hash className="h-3.5 w-3.5 mr-1" />Kalit so'zlar
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs">
            <ShoppingCart className="h-3.5 w-3.5 mr-1" />Mahsulotlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keywords" className="space-y-3 mt-3">
          {/* Search + Sort */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Kalit so'z qidirish..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frequency">Chastota</SelectItem>
                <SelectItem value="orders">Buyurtma</SelectItem>
                <SelectItem value="clicks">Kliklar</SelectItem>
                <SelectItem value="position">Pozitsiya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : sorted.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Qidiruv so'zlari topilmadi
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {sorted.slice(0, 50).map((kw: any, idx: number) => (
                <Card key={kw.text}>
                  <CardContent className="p-2.5 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{kw.text}</p>
                      <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="h-2.5 w-2.5" />{kw.totalFrequency}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-2.5 w-2.5" />{kw.totalClicks}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ShoppingCart className="h-2.5 w-2.5" />{kw.totalOrders}
                        </span>
                        {kw.avgPosition > 0 && (
                          <span>📍 {kw.avgPosition}-o'rin</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {kw.totalOrders > 0 && (
                        <Badge variant="default" className="text-[10px] px-1.5">
                          {kw.totalOrders} ta
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {kw.productCount} mahsulot
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-3 mt-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : productKeywords.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Ma'lumot topilmadi
              </CardContent>
            </Card>
          ) : (
            productKeywords.map((prod: any) => (
              <Card key={prod.nmID}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    {prod.photo && (
                      <img src={prod.photo} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{prod.title || prod.vendorCode}</p>
                      <p className="text-[10px] text-muted-foreground">nmID: {prod.nmID}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {prod.topKeywords.slice(0, 8).map((kw: any, i: number) => (
                      <Badge
                        key={i}
                        variant={kw.orders > 0 ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5"
                      >
                        {kw.text}
                        {kw.frequency > 0 && <span className="ml-1 opacity-60">({kw.frequency})</span>}
                      </Badge>
                    ))}
                    {prod.topKeywords.length > 8 && (
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        +{prod.topKeywords.length - 8}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
