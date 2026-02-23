import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Eye, ShoppingCart, Package, TrendingUp, RefreshCw, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface WBSellerAnalyticsProps {
  connectedMarketplaces: string[];
}

export function WBSellerAnalytics({ connectedMarketplaces }: WBSellerAnalyticsProps) {
  const [period, setPeriod] = useState(7);
  const hasWB = connectedMarketplaces.includes('wildberries');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['wb-seller-analytics', period],
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

  if (!hasWB) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          WB ulangan emas. Avval Wildberries marketplace ulang.
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summary;
  const cards = data?.data || [];

  const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />WB Analitika
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

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Eye className="h-3.5 w-3.5" /><span className="text-[11px]">Ko'rishlar</span>
                </div>
                <p className="text-lg font-bold">{formatNum(summary.totalViews)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <ShoppingCart className="h-3.5 w-3.5" /><span className="text-[11px]">Savatga</span>
                </div>
                <p className="text-lg font-bold">{formatNum(summary.totalAddToCart)}</p>
                <p className="text-[10px] text-muted-foreground">{summary.avgConversionToCart?.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Package className="h-3.5 w-3.5" /><span className="text-[11px]">Buyurtmalar</span>
                </div>
                <p className="text-lg font-bold">{formatNum(summary.totalOrders)}</p>
                <p className="text-[10px] text-muted-foreground">{formatNum(summary.totalOrdersSum)} ₽</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /><span className="text-[11px]">Sotuvlar</span>
                </div>
                <p className="text-lg font-bold">{formatNum(summary.totalBuyouts)}</p>
                <p className="text-[10px] text-muted-foreground">{formatNum(summary.totalBuyoutsSum)} ₽</p>
              </CardContent>
            </Card>
          </div>

          {/* Funnel visualization */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Konversiya funnel</p>
              <div className="flex items-center gap-1 text-xs">
                <span className="font-medium">{formatNum(summary.totalViews)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{formatNum(summary.totalAddToCart)}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{summary.avgConversionToCart?.toFixed(1)}%</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{formatNum(summary.totalOrders)}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{summary.avgConversionToOrder?.toFixed(1)}%</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Top products */}
          <h3 className="text-sm font-semibold">Top mahsulotlar</h3>
          <div className="space-y-2">
            {cards.slice(0, 15).map((card: any, idx: number) => (
              <Card key={card.nmID || idx}>
                <CardContent className="p-3 flex items-center gap-3">
                  {card.photo && (
                    <img src={card.photo} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.title || card.vendorCode}</p>
                    <p className="text-[11px] text-muted-foreground">{card.objectName}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>👁 {card.openCardCount}</span>
                      <span>🛒 {card.addToCartCount}</span>
                      <span>📦 {card.ordersCount}</span>
                      <span>💰 {formatNum(card.ordersSumRub)} ₽</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={card.conversions.addToCartPercent > 5 ? 'default' : 'secondary'} className="text-[10px]">
                      {card.conversions.addToCartPercent?.toFixed(1)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Ma'lumot topilmadi
          </CardContent>
        </Card>
      )}
    </div>
  );
}
