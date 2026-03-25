import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp, RefreshCw, DollarSign, BarChart3, Flame, Package,
  ShoppingCart, Brain, Sparkles, Target, Shield, Clock, Zap,
  ExternalLink, Globe, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

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

const formatMoney = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
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
  if (dir === "tez_o'sish") return <Zap className="h-3 w-3 text-green-500" />;
  if (dir === "sekin_o'sish") return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (dir === 'mavsumiy') return <Clock className="h-3 w-3 text-orange-500" />;
  return <BarChart3 className="h-3 w-3 text-blue-500" />;
};

const CATEGORIES = [
  { value: 'all', label: 'Barcha kategoriyalar' },
  { value: 'electronics', label: '📱 Elektronika' },
  { value: 'fashion', label: '👗 Kiyim-kechak' },
  { value: 'home', label: '🏠 Uy jihozlari' },
  { value: 'beauty', label: '💄 Go\'zallik' },
  { value: 'toys', label: '🧸 O\'yinchoqlar' },
  { value: 'sports', label: '⚽ Sport' },
  { value: 'auto', label: '🚗 Avto aksessuarlar' },
  { value: 'kitchen', label: '🍳 Oshxona' },
  { value: 'garden', label: '🌿 Bog\' & hovli' },
  { value: 'pet', label: '🐾 Hayvonlar uchun' },
];

const PERIODS = [
  { value: '7', label: '7 kun' },
  { value: '14', label: '14 kun' },
  { value: '30', label: '30 kun' },
];

export function MobileTrendHunter() {
  const [category, setCategory] = useState('all');
  const [period, setPeriod] = useState('14');

  const predictionMutation = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.functions.invoke('ai-trend-predict', {
        body: {
          category: category === 'all' ? undefined : category,
          period: parseInt(period),
          include_source_links: true,
          global_trends: true,
        },
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
  const marketSummary: MarketSummary | null = predictionMutation.data?.market_summary || null;

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
              <p className="text-[10px] text-muted-foreground">Dunyo bozori trendlari</p>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => predictionMutation.mutate()}
            disabled={predictionMutation.isPending}
            className="text-xs"
          >
            <Brain className={`h-3.5 w-3.5 mr-1 ${predictionMutation.isPending ? 'animate-pulse' : ''}`} />
            {predictionMutation.isPending ? 'Tahlil...' : 'Trendlarni topish'}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
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
            <SelectTrigger className="h-8 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Market summary */}
        {marketSummary && (
          <Card className="mt-2 border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary mb-1">AI Bozor xulosasi</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{marketSummary.overall_trend}</p>
                  {marketSummary.hot_categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {marketSummary.hot_categories.slice(0, 6).map((cat, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">{cat}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {predictionMutation.isPending ? (
          <div className="space-y-3">
            <Card className="bg-muted/50">
              <CardContent className="p-6 text-center">
                <Brain className="h-10 w-10 mx-auto text-primary mb-3 animate-pulse" />
                <h4 className="font-semibold mb-1">AI dunyo bozorini tahlil qilmoqda...</h4>
                <p className="text-xs text-muted-foreground">Global trendlar, mavsumiylik, narxlar va xitoy optom manbalarini tahlil qilmoqda</p>
              </CardContent>
            </Card>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : predictions.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <Globe className="h-12 w-12 mx-auto text-primary/50 mb-3" />
              <h4 className="font-semibold mb-2">Dunyo bozori trendlari</h4>
              <p className="text-xs text-muted-foreground mb-4">
                AI dunyo bozorida qaysi tovarlar trendga chiqayotganini aniqlaydi,
                O'zbekistonga import qilish potentsialini baholaydi, va xitoy
                optom saytlaridan to'g'ridan-to'g'ri xarid qilish havolalarini beradi.
              </p>
              <Button onClick={() => predictionMutation.mutate()} className="gap-2">
                <Brain className="h-4 w-4" />
                Trendlarni topish
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
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
                      {pred.trend_direction.replace(/_/g, ' ')}
                    </Badge>
                    {pred.risk_level && (
                      <Badge variant="outline" className="text-[9px]">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />
                        Risk: {pred.risk_level}
                      </Badge>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-[10px] text-muted-foreground leading-relaxed mb-1">{pred.reason}</p>
                  
                  {pred.global_trend_data && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mb-1">
                      <Globe className="h-2.5 w-2.5 inline mr-0.5" />
                      {pred.global_trend_data}
                    </p>
                  )}

                  {pred.best_time_to_enter && (
                    <p className="text-[10px] text-primary mb-2 font-medium">
                      <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                      {pred.best_time_to_enter}
                    </p>
                  )}

                  {/* Source links - Chinese wholesale */}
                  {pred.source_links && pred.source_links.length > 0 && (
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" /> Xarid manbalari:
                      </p>
                      {pred.source_links.map((link, li) => (
                        <a
                          key={li}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors group"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium truncate group-hover:text-primary">{link.platform}</p>
                            {link.price_range && (
                              <p className="text-[9px] text-muted-foreground">{link.price_range}</p>
                            )}
                          </div>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                        </a>
                      ))}
                    </div>
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
      </div>
    </div>
  );
}