import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp, DollarSign, BarChart3, Flame, Package,
  ShoppingCart, Brain, Sparkles, Target, Shield, Clock, Zap,
  Globe, ArrowUpRight, Search, ImageOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface TrendPrediction {
  product_name: string;
  category: string;
  demand_score: number;
  price_min: number;
  price_max: number;
  china_price_usd?: number;
  monthly_sales_estimate: number;
  net_profit_potential: number;
  competition_level: string;
  trend_direction: string;
  reason: string;
  best_time_to_enter?: string;
  risk_level?: string;
  image_url?: string;
  image_search_query?: string;
  source_links?: Array<{
    platform: string;
    url: string;
    price_range?: string;
  }>;
  global_trend_data?: string;
}

interface MarketSummary {
  overall_trend: string;
  hot_categories: string[];
  seasonal_factors: string;
  recommendation: string;
}

interface CachedData {
  predictions: TrendPrediction[];
  market_summary: MarketSummary | null;
  generated_at: string;
  category: string;
  period: string;
}

const CACHE_KEY = 'trend_hunter_cache';

const loadCache = (): CachedData | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedData;
    // Cache valid for 2 hours
    const age = Date.now() - new Date(data.generated_at).getTime();
    if (age > 2 * 60 * 60 * 1000) return null;
    return data;
  } catch { return null; }
};

const saveCache = (data: CachedData) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
};

const formatMoney = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} mlrd`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mln`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const getDemandBadge = (score: number) => {
  if (score >= 80) return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">🔥 Juda yuqori</Badge>;
  if (score >= 60) return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">⬆ Yuqori</Badge>;
  if (score >= 40) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]">📈 O'rta</Badge>;
  return <Badge variant="secondary" className="text-[10px]">📊 Past</Badge>;
};

const getCompBadge = (level: string) => {
  if (level === 'past') return <Badge className="bg-green-500/10 text-green-600 text-[10px]">✅ Past</Badge>;
  if (level === "o'rta") return <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px]">⚡ O'rta</Badge>;
  return <Badge className="bg-red-500/10 text-red-600 text-[10px]">🔴 Yuqori</Badge>;
};

const getTrendLabel = (dir: string) => {
  if (dir === "tez_o'sish") return "Tez o'sish";
  if (dir === "sekin_o'sish") return "Sekin o'sish";
  if (dir === 'mavsumiy') return 'Mavsumiy';
  return 'Barqaror';
};

const CATEGORIES = [
  { value: 'all', label: 'Barcha kategoriyalar' },
  { value: 'electronics', label: '📱 Elektronika' },
  { value: 'fashion', label: '👗 Kiyim & Aksessuarlar' },
  { value: 'home', label: '🏠 Uy jihozlari' },
  { value: 'beauty', label: '💄 Go\'zallik' },
  { value: 'toys', label: '🧸 Bolalar' },
  { value: 'sports', label: '⚽ Sport' },
  { value: 'auto', label: '🚗 Avto' },
  { value: 'kitchen', label: '🍳 Oshxona' },
  { value: 'pet', label: '🐾 Hayvonlar' },
];

const PERIODS = [
  { value: '7', label: '7 kun' },
  { value: '14', label: '14 kun' },
  { value: '30', label: '30 kun' },
];

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return (
      <div className="w-full h-full bg-muted/50 flex items-center justify-center">
        <ImageOff className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

export function MobileTrendHunter() {
  const [category, setCategory] = useState('all');
  const [period, setPeriod] = useState('14');
  const [predictions, setPredictions] = useState<TrendPrediction[]>([]);
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  const isMobile = useIsMobile();

  // Load cached data on mount
  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setPredictions(cached.predictions);
      setMarketSummary(cached.market_summary);
      setCategory(cached.category);
      setPeriod(cached.period);
    }
  }, []);

  const predictionMutation = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.functions.invoke('ai-trend-predict', {
        body: {
          category: category === 'all' ? undefined : category,
          period: parseInt(period),
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      const preds = data?.predictions || [];
      const summary = data?.market_summary || null;
      setPredictions(preds);
      setMarketSummary(summary);
      saveCache({
        predictions: preds,
        market_summary: summary,
        generated_at: data?.generated_at || new Date().toISOString(),
        category,
        period,
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'AI bashorat xatoligi');
    },
  });

  return (
    <div className={isMobile ? "flex flex-col pb-20" : "flex flex-col h-full"}>
      {/* Header */}
      <div className={`bg-background z-30 ${isMobile ? 'px-3 py-3' : 'px-0 py-4'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
            <Flame className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Trend Hunter AI</h2>
            <p className="text-[10px] text-muted-foreground">Xitoydan import uchun trend tovarlar</p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="default"
            size="sm"
            onClick={() => predictionMutation.mutate()}
            disabled={predictionMutation.isPending}
            className="text-xs gap-1 shrink-0 h-8"
          >
            {predictionMutation.isPending ? (
              <Brain className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {predictionMutation.isPending ? 'Tahlil...' : 'Topish'}
          </Button>
        </div>
      </div>

      {/* Market summary */}
      {marketSummary && (
        <div className={isMobile ? 'px-3 pt-2' : 'pt-2'}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary mb-1">AI Bozor xulosasi</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{marketSummary.overall_trend}</p>
                  {marketSummary.hot_categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {marketSummary.hot_categories.slice(0, 5).map((cat, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">{cat}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 py-3 space-y-3 ${isMobile ? 'px-3' : 'px-0'}`}>
        {predictionMutation.isPending ? (
          <div className="space-y-3">
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <Brain className="h-8 w-8 mx-auto text-primary mb-2 animate-pulse" />
                <p className="text-xs font-semibold">AI dunyo bozorini tahlil qilmoqda...</p>
                <p className="text-[10px] text-muted-foreground mt-1">Amazon, TikTok, AliExpress trendlarini skanerlash</p>
              </CardContent>
            </Card>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center mx-auto mb-3">
              <Globe className="h-7 w-7 text-orange-500" />
            </div>
            <p className="text-sm font-semibold mb-1">Trend tovarlarni toping</p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              Kategoriyani tanlang va "Topish" tugmasini bosing. AI dunyo bozoridan eng foydali tovarlarni topadi.
            </p>
          </div>
        ) : (
          <div className={isMobile ? 'space-y-3' : 'grid grid-cols-1 xl:grid-cols-2 gap-4'}>
            {predictions.map((pred, idx) => (
              <Card key={idx} className="overflow-hidden hover:shadow-md transition-shadow">
                {/* Product header */}
                <div className="p-3 pb-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {idx < 3 && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-[10px] font-bold text-white shadow shrink-0">
                          {idx + 1}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{pred.product_name}</p>
                        <p className="text-[10px] text-muted-foreground">{pred.category}</p>
                      </div>
                    </div>
                    {getCompBadge(pred.competition_level)}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {getDemandBadge(pred.demand_score)}
                  </div>
                </div>

                <CardContent className="p-3">
                  {/* Key metrics */}
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] mb-2">
                    <div className="bg-muted/50 rounded-lg p-1.5 text-center">
                      <DollarSign className="h-3 w-3 mx-auto text-emerald-500 mb-0.5" />
                      <p className="font-bold text-[11px]">{formatMoney(pred.price_min)}-{formatMoney(pred.price_max)}</p>
                      <p className="text-muted-foreground">Sotish</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-1.5 text-center">
                      <Package className="h-3 w-3 mx-auto text-orange-500 mb-0.5" />
                      <p className="font-bold text-[11px]">${pred.china_price_usd || '?'}</p>
                      <p className="text-muted-foreground">Xitoy</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-1.5 text-center">
                      <ShoppingCart className="h-3 w-3 mx-auto text-blue-500 mb-0.5" />
                      <p className="font-bold text-[11px]">{pred.monthly_sales_estimate >= 1000 ? `${(pred.monthly_sales_estimate / 1000).toFixed(1)}K` : pred.monthly_sales_estimate}</p>
                      <p className="text-muted-foreground">Oy/sotuv</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-1.5 text-center">
                      <TrendingUp className="h-3 w-3 mx-auto text-primary mb-0.5" />
                      <p className="font-bold text-[11px]">{formatMoney(pred.net_profit_potential)}</p>
                      <p className="text-muted-foreground">Foyda/oy</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="outline" className="text-[9px] gap-0.5">
                      <Zap className="h-2.5 w-2.5" />
                      {getTrendLabel(pred.trend_direction)}
                    </Badge>
                    {pred.risk_level && (
                      <Badge variant="outline" className="text-[9px]">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />
                        Risk: {pred.risk_level}
                      </Badge>
                    )}
                    {pred.best_time_to_enter && (
                      <Badge variant="outline" className="text-[9px]">
                        <Clock className="h-2.5 w-2.5 mr-0.5" />
                        {pred.best_time_to_enter}
                      </Badge>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{pred.reason}</p>

                  {pred.global_trend_data && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mb-2">
                      <Globe className="h-3 w-3 inline mr-0.5" />
                      {pred.global_trend_data}
                    </p>
                  )}

                  {/* Source links */}
                  {pred.source_links && pred.source_links.length > 0 && (
                    <div className="border-t pt-2 space-y-1.5">
                      <p className="text-[10px] font-semibold flex items-center gap-1">
                        <Package className="h-3 w-3" /> Xitoydan xarid:
                      </p>
                      {pred.source_links.map((link, li) => (
                        <a
                          key={li}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/50 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all group"
                        >
                          <div className="w-6 h-6 rounded-md bg-background flex items-center justify-center shrink-0 border text-sm">
                            {link.platform.includes('1688') ? '🇨🇳' : link.platform.includes('Ali') ? '🌐' : '🛒'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium group-hover:text-primary">{link.platform}</p>
                            {link.price_range && (
                              <p className="text-[10px] text-muted-foreground">{link.price_range}</p>
                            )}
                          </div>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* AI recommendation */}
            {marketSummary?.recommendation && (
              <Card className="border-primary/20 bg-primary/5 col-span-full">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold mb-1">AI strategik tavsiya</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{marketSummary.recommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
