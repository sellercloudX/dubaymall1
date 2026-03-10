import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, RefreshCw, DollarSign, BarChart3, Flame, Star, Package,
  ArrowUpRight, Eye, MousePointerClick, ShoppingCart, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { rubToUzs, formatUzs } from '@/lib/currency';

interface TrendKeyword {
  text: string;
  totalFrequency: number;
  totalOrders: number;
  totalClicks: number;
  avgPosition: number;
  productCount: number;
}

const formatMoney = (n: number) => formatUzs(rubToUzs(n)) + " so'm";
const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));

const getScoreBadge = (score: number) => {
  if (score >= 80) return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">🔥 Hot</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]">⬆ Rising</Badge>;
  return <Badge variant="secondary" className="text-[10px]">📈 Stable</Badge>;
};

export function MobileTrendHunter() {
  const [activeTab, setActiveTab] = useState<'keywords' | 'products'>('keywords');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['wb-trend-hunter'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: 'wildberries', dataType: 'search-queries', period: 14 },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const keywords: TrendKeyword[] = data?.keywords || [];
  const productKeywords = data?.productKeywords || [];
  const summary = data?.summary;

  // Calculate trend score for keywords
  const scoredKeywords = keywords.slice(0, 50).map(k => {
    const conversionRate = k.totalClicks > 0 ? (k.totalOrders / k.totalClicks) * 100 : 0;
    const score = Math.min(100, Math.round(
      (k.totalFrequency > 500 ? 30 : k.totalFrequency / 500 * 30) +
      (k.totalOrders > 10 ? 25 : k.totalOrders / 10 * 25) +
      (conversionRate > 5 ? 25 : conversionRate / 5 * 25) +
      (k.avgPosition > 0 && k.avgPosition < 20 ? 20 : k.avgPosition > 0 ? Math.max(0, 20 - k.avgPosition / 5) : 0)
    ));
    return { ...k, score, conversionRate };
  }).sort((a, b) => b.score - a.score);

  const hasData = !data?.requiresJam && keywords.length > 0;
  const requiresJam = data?.requiresJam;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem - env(safe-area-inset-top, 0px) - 5rem)' }}>
      {/* Header */}
      <div className="sticky top-14 bg-background z-30 px-3 py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Trend Hunter</h2>
              <p className="text-[10px] text-muted-foreground">WB qidiruv tahlili</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { toast.info('Trendlar yangilanmoqda...'); refetch(); }} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Yangilash
          </Button>
        </div>

        {summary && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Badge variant="outline" className="shrink-0 text-xs">
              <Search className="h-3 w-3 mr-1" />
              {summary.totalKeywords} kalit so'z
            </Badge>
            <Badge variant="outline" className="shrink-0 text-xs">
              <ShoppingCart className="h-3 w-3 mr-1" />
              {summary.totalSearchOrders} buyurtma
            </Badge>
            <Badge variant="outline" className="shrink-0 text-xs">
              <Star className="h-3 w-3 mr-1" />
              Top: {summary.topKeyword}
            </Badge>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-2">
          <TabsList className="w-full grid grid-cols-2 h-8">
            <TabsTrigger value="keywords" className="text-xs">Kalit so'zlar</TabsTrigger>
            <TabsTrigger value="products" className="text-xs">Mahsulotlar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : requiresJam ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <Flame className="h-10 w-10 mx-auto text-orange-500 mb-3" />
              <h4 className="font-semibold mb-1">WB Jam obunasi talab etiladi</h4>
              <p className="text-xs text-muted-foreground">
                Trend Hunter WB qidiruv analitikasiga asoslangan. Bu ma'lumotlarga kirish uchun
                WB Jam obunasi kerak.
              </p>
            </CardContent>
          </Card>
        ) : !hasData ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h4 className="font-semibold mb-1">Ma'lumot topilmadi</h4>
              <p className="text-xs text-muted-foreground">WB marketplace ulang va qaytadan urining</p>
            </CardContent>
          </Card>
        ) : activeTab === 'keywords' ? (
          <>
            {scoredKeywords.map((kw, idx) => (
              <Card key={kw.text} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {idx < 3 && (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {idx + 1}
                        </div>
                      )}
                      <p className="text-sm font-medium truncate">{kw.text}</p>
                    </div>
                    {getScoreBadge(kw.score)}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <Search className="h-3 w-3 text-blue-500" />
                      <div>
                        <p className="font-semibold">{formatNum(kw.totalFrequency)}</p>
                        <p className="text-muted-foreground">chastota</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <MousePointerClick className="h-3 w-3 text-purple-500" />
                      <div>
                        <p className="font-semibold">{formatNum(kw.totalClicks)}</p>
                        <p className="text-muted-foreground">bosish</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3 text-green-500" />
                      <div>
                        <p className="font-semibold">{kw.totalOrders}</p>
                        <p className="text-muted-foreground">buyurtma</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-orange-500" />
                      <div>
                        <p className="font-semibold">{kw.conversionRate.toFixed(1)}%</p>
                        <p className="text-muted-foreground">konversiya</p>
                      </div>
                    </div>
                  </div>
                  {kw.avgPosition > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      O'rtacha pozitsiya: #{kw.avgPosition} | {kw.productCount} mahsulotda
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {productKeywords.map((prod: any, idx: number) => (
              <Card key={prod.nmID}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {prod.photo && (
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                        <img src={prod.photo} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{prod.title || `nmID: ${prod.nmID}`}</p>
                      <p className="text-[10px] text-muted-foreground">{prod.vendorCode} · {prod.topKeywords?.length || 0} kalit so'z</p>
                    </div>
                  </div>
                  {prod.topKeywords?.slice(0, 5).map((kw: any, ki: number) => (
                    <div key={ki} className="flex items-center justify-between py-1 border-t first:border-t-0 text-[10px]">
                      <span className="truncate flex-1 mr-2">{kw.text}</span>
                      <div className="flex gap-2 shrink-0 text-muted-foreground">
                        <span>{formatNum(kw.frequency)} qidiruv</span>
                        {kw.orders > 0 && <span className="text-green-600 font-medium">{kw.orders} buyurtma</span>}
                        {kw.position > 0 && <span>#{kw.position}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
