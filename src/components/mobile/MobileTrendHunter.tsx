import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp, RefreshCw, DollarSign, BarChart3, Flame, Star, Package,
  ArrowUpRight, Eye, MousePointerClick, ShoppingCart, Search, Brain,
  Sparkles, Target, Shield, Clock, Zap, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rubToUzs, formatUzs } from '@/lib/currency';

interface TrendKeyword {
  text: string;
  totalFrequency: number;
  totalOrders: number;
  totalClicks: number;
  avgPosition: number;
  productCount: number;
}

interface TrendPrediction {
  product_name: string;
  category: string;
  demand_score: number;
  price_min: number;
  price_max: number;
  monthly_sales_estimate: number;
  net_profit_potential: number;
  competition_level: string;
  trend_direction: string;
  reason: string;
  best_time_to_enter?: string;
  risk_level?: string;
}

const formatMoney = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));

const getDemandBadge = (score: number) => {
  if (score >= 80) return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">🔥 Juda yuqori</Badge>;
  if (score >= 60) return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">⬆ Yuqori</Badge>;
  if (score >= 40) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]">📈 O'rta</Badge>;
  return <Badge variant="secondary" className="text-[10px]">📊 Past</Badge>;
};

const getCompBadge = (level: string) => {
  if (level === 'past') return <Badge className="bg-green-500/10 text-green-600 text-[10px]">Past raqobat</Badge>;
  if (level === "o'rta") return <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px]">O'rta</Badge>;
  return <Badge className="bg-red-500/10 text-red-600 text-[10px]">Yuqori</Badge>;
};

const getTrendIcon = (dir: string) => {
  if (dir === 'tez_o\'sish') return <Zap className="h-3 w-3 text-green-500" />;
  if (dir === 'sekin_o\'sish') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (dir === 'mavsumiy') return <Clock className="h-3 w-3 text-orange-500" />;
  return <BarChart3 className="h-3 w-3 text-blue-500" />;
};

const getScoreBadge = (score: number) => {
  if (score >= 80) return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">🔥 Hot</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]">⬆ Rising</Badge>;
  return <Badge variant="secondary" className="text-[10px]">📈 Stable</Badge>;
};

export function MobileTrendHunter() {
  const [activeTab, setActiveTab] = useState<'predictions' | 'keywords' | 'products'>('predictions');

  // Fetch WB search data
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

  // AI Predictions
  const predictionMutation = useMutation({
    mutationFn: async () => {
      const keywords = data?.keywords || [];
      const { data: result, error } = await supabase.functions.invoke('ai-trend-predict', {
        body: { keywords: keywords.slice(0, 50), marketplace: 'wildberries' },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onError: (err: any) => {
      toast.error(err.message || 'AI bashorat xatoligi');
    },
  });

  const predictions: TrendPrediction[] = predictionMutation.data?.predictions || [];
  const marketSummary = predictionMutation.data?.market_summary;

  const keywords: TrendKeyword[] = data?.keywords || [];
  const productKeywords = data?.productKeywords || [];
  const summary = data?.summary;

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
              <h2 className="font-bold text-sm">Trend Hunter AI</h2>
              <p className="text-[10px] text-muted-foreground">Bashorat va tahlil</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => predictionMutation.mutate()} 
              disabled={predictionMutation.isPending || !hasData}
              className="text-xs"
            >
              <Brain className={`h-3.5 w-3.5 mr-1 ${predictionMutation.isPending ? 'animate-pulse' : ''}`} />
              AI Bashorat
            </Button>
            <Button variant="outline" size="sm" onClick={() => { toast.info('Trendlar yangilanmoqda...'); refetch(); }} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Market summary */}
        {marketSummary && (
          <Card className="mb-2 border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary mb-1">AI Bozor xulosasi</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{marketSummary.overall_trend}</p>
                  {marketSummary.hot_categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {marketSummary.hot_categories.slice(0, 5).map((cat: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">{cat}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {summary && !marketSummary && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Badge variant="outline" className="shrink-0 text-xs">
              <Search className="h-3 w-3 mr-1" />
              {summary.totalKeywords} kalit so'z
            </Badge>
            <Badge variant="outline" className="shrink-0 text-xs">
              <ShoppingCart className="h-3 w-3 mr-1" />
              {summary.totalSearchOrders} buyurtma
            </Badge>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-2">
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="predictions" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />AI Bashorat
            </TabsTrigger>
            <TabsTrigger value="keywords" className="text-xs">Kalit so'zlar</TabsTrigger>
            <TabsTrigger value="products" className="text-xs">Mahsulotlar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {activeTab === 'predictions' ? (
          <>
            {predictionMutation.isPending ? (
              <div className="space-y-3">
                <Card className="bg-muted/50">
                  <CardContent className="p-6 text-center">
                    <Brain className="h-10 w-10 mx-auto text-primary mb-3 animate-pulse" />
                    <h4 className="font-semibold mb-1">AI bozorni tahlil qilmoqda...</h4>
                    <p className="text-xs text-muted-foreground">WB qidiruv ma'lumotlari, mavsumiylik, va bozor signallari tahlil qilinmoqda</p>
                  </CardContent>
                </Card>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : predictions.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="p-6 text-center">
                  <Brain className="h-12 w-12 mx-auto text-primary/50 mb-3" />
                  <h4 className="font-semibold mb-2">AI Trend Bashorat</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    {hasData 
                      ? 'WB qidiruv ma\'lumotlari asosida AI yaqin kelajakdagi trendlarni bashorat qiladi: qaysi mahsulotlar sotiladi, qanchadan, va sof foyda potentsiali.'
                      : requiresJam 
                        ? 'WB Jam obunasi talab etiladi. Ulanganingizdan keyin AI bashorat ishlaydi.'
                        : 'Avval WB marketplace ulang va "Yangilash" tugmasini bosing.'}
                  </p>
                  {hasData && (
                    <Button onClick={() => predictionMutation.mutate()} className="gap-2">
                      <Brain className="h-4 w-4" />
                      Bashoratni boshlash
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Prediction cards */}
                {predictions.map((pred, idx) => (
                  <Card key={idx} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {idx < 3 && (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {idx + 1}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{pred.product_name}</p>
                            <p className="text-[10px] text-muted-foreground">{pred.category}</p>
                          </div>
                        </div>
                        {getDemandBadge(pred.demand_score)}
                      </div>

                      {/* Key metrics grid */}
                      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <DollarSign className="h-3 w-3 mx-auto text-emerald-500 mb-0.5" />
                          <p className="font-bold text-xs">{formatMoney(pred.price_min)}-{formatMoney(pred.price_max)}</p>
                          <p className="text-muted-foreground">Narx oralig'i</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <ShoppingCart className="h-3 w-3 mx-auto text-blue-500 mb-0.5" />
                          <p className="font-bold text-xs">{formatNum(pred.monthly_sales_estimate)}</p>
                          <p className="text-muted-foreground">Oylik sotuv</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <TrendingUp className="h-3 w-3 mx-auto text-primary mb-0.5" />
                          <p className="font-bold text-xs">{formatMoney(pred.net_profit_potential)}</p>
                          <p className="text-muted-foreground">Sof foyda/oy</p>
                        </div>
                      </div>

                      {/* Tags row */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {getCompBadge(pred.competition_level)}
                        <Badge variant="outline" className="text-[9px] gap-0.5">
                          {getTrendIcon(pred.trend_direction)}
                          {pred.trend_direction.replace('_', ' ')}
                        </Badge>
                        {pred.risk_level && (
                          <Badge variant="outline" className="text-[9px]">
                            <Shield className="h-2.5 w-2.5 mr-0.5" />
                            Risk: {pred.risk_level}
                          </Badge>
                        )}
                      </div>

                      {/* Reason */}
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{pred.reason}</p>
                      {pred.best_time_to_enter && (
                        <p className="text-[10px] text-primary mt-1 font-medium">
                          <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                          {pred.best_time_to_enter}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* AI recommendation */}
                {marketSummary?.recommendation && (
                  <Card className="border-primary/20">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium mb-1">AI tavsiyasi</p>
                          <p className="text-[11px] text-muted-foreground">{marketSummary.recommendation}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        ) : isLoading ? (
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
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {productKeywords.map((prod: any) => (
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
