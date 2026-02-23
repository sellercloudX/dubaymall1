import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Play, Pause, Eye, MousePointerClick, ShoppingCart, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface WBAdsCampaignsProps {
  connectedMarketplaces: string[];
}

export function WBAdsCampaigns({ connectedMarketplaces }: WBAdsCampaignsProps) {
  const queryClient = useQueryClient();
  const hasWB = connectedMarketplaces.includes('wildberries');
  const [actioningId, setActioningId] = useState<number | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['wb-ads-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: 'wildberries', dataType: 'ads-campaigns' },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasWB,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const handleAction = async (advertId: number, action: 'ads-pause' | 'ads-start') => {
    setActioningId(advertId);
    try {
      const { error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: 'wildberries', dataType: action, advertId },
      });
      if (error) throw error;
      toast.success(action === 'ads-pause' ? 'Kampaniya to\'xtatildi' : 'Kampaniya ishga tushirildi');
      queryClient.invalidateQueries({ queryKey: ['wb-ads-campaigns'] });
    } catch (e) {
      toast.error('Amal bajarishda xato');
    } finally {
      setActioningId(null);
    }
  };

  if (!hasWB) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          WB ulangan emas. Avval Wildberries marketplace ulang.
        </CardContent>
      </Card>
    );
  }

  const campaigns = data?.data || [];
  const summary = data?.summary;
  const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
  const formatMoney = (n: number) => `${formatNum(n)} ₽`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />WB Reklama
        </h2>
        <Button size="icon" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {/* Summary */}
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
                  <Megaphone className="h-3.5 w-3.5" /><span className="text-[11px]">Kampaniyalar</span>
                </div>
                <p className="text-lg font-bold">{summary.total}</p>
                <div className="flex gap-1 mt-1">
                  <Badge variant="default" className="text-[10px] px-1">{summary.active} faol</Badge>
                  <Badge variant="secondary" className="text-[10px] px-1">{summary.paused} pauzada</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" /><span className="text-[11px]">Xarajat (7 kun)</span>
                </div>
                <p className="text-lg font-bold">{formatMoney(summary.totalSpent)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Eye className="h-3.5 w-3.5" /><span className="text-[11px]">Ko'rishlar</span>
                </div>
                <p className="text-lg font-bold">{formatNum(summary.totalViews)}</p>
                <p className="text-[10px] text-muted-foreground">{formatNum(summary.totalClicks)} bosish</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <ShoppingCart className="h-3.5 w-3.5" /><span className="text-[11px]">Buyurtmalar</span>
                </div>
                <p className="text-lg font-bold">{summary.totalOrders}</p>
              </CardContent>
            </Card>
          </div>

          {/* Campaign list */}
          <h3 className="text-sm font-semibold">Kampaniyalar ro'yxati</h3>
          <div className="space-y-2">
            {campaigns.map((c: any) => (
              <Card key={c.advertId}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name || `#${c.advertId}`}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge variant={c.status === 9 ? 'default' : c.status === 11 ? 'secondary' : 'outline'} className="text-[10px]">
                          {c.statusLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{c.typeLabel}</Badge>
                        {c.subjectName && <Badge variant="outline" className="text-[10px]">{c.subjectName}</Badge>}
                      </div>
                      {c.stats && (
                        <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{formatNum(c.stats.views)}</span>
                          <span className="flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" />{formatNum(c.stats.clicks)}</span>
                          <span className="flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />CTR {c.stats.ctr?.toFixed(2)}%</span>
                          <span className="flex items-center gap-0.5"><ShoppingCart className="h-3 w-3" />{c.stats.orders}</span>
                          <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" />{formatMoney(c.stats.sum)}</span>
                        </div>
                      )}
                      {c.cpm > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">CPM: {c.cpm} ₽ | Kunlik: {formatMoney(c.dailyBudget || 0)}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {c.status === 9 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" 
                          onClick={() => handleAction(c.advertId, 'ads-pause')}
                          disabled={actioningId === c.advertId}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {c.status === 11 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => handleAction(c.advertId, 'ads-start')}
                          disabled={actioningId === c.advertId}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {campaigns.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Reklama kampaniyalari topilmadi
                </CardContent>
              </Card>
            )}
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
