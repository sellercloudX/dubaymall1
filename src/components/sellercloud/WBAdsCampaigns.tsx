import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Megaphone, Play, Pause, Eye, MousePointerClick, ShoppingCart, DollarSign, RefreshCw, TrendingUp, Wallet, Settings2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rubToUzs, formatUzs } from '@/lib/currency';

interface WBAdsCampaignsProps {
  connectedMarketplaces: string[];
}

export function WBAdsCampaigns({ connectedMarketplaces }: WBAdsCampaignsProps) {
  const queryClient = useQueryClient();
  const hasWB = connectedMarketplaces.includes('wildberries');
  const [actioningId, setActioningId] = useState<number | null>(null);
  // Budget/CPM edit dialog
  const [editDialog, setEditDialog] = useState<{
    type: 'budget' | 'cpm';
    advertId: number;
    currentValue: number;
    campaignName: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);

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

  // Ads balance
  const { data: balanceData } = useQuery({
    queryKey: ['wb-ads-balance'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: 'wildberries', dataType: 'ads-balance' },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasWB,
    staleTime: 1000 * 60 * 10,
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

  const handleEditSave = async () => {
    if (!editDialog) return;
    const numValue = Number(editValue);
    if (!numValue || numValue <= 0) { toast.error('Qiymatni to\'g\'ri kiriting'); return; }
    
    setEditLoading(true);
    try {
      const dataType = editDialog.type === 'budget' ? 'ads-budget' : 'ads-cpm';
      const body: any = { marketplace: 'wildberries', dataType, advertId: editDialog.advertId };
      if (editDialog.type === 'budget') body.dailyBudget = numValue;
      else body.cpm = numValue;

      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', { body });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      
      toast.success(editDialog.type === 'budget' ? 'Byudjet yangilandi' : 'CPM stavka yangilandi');
      queryClient.invalidateQueries({ queryKey: ['wb-ads-campaigns'] });
      setEditDialog(null);
    } catch (e: any) {
      toast.error(e?.message || 'Xato yuz berdi');
    } finally {
      setEditLoading(false);
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
  const formatMoney = (n: number) => formatUzs(rubToUzs(n)) + " so'm";
  const formatRub = (n: number) => `${Math.round(n).toLocaleString()} ₽`;

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

      {/* Ads Balance */}
      {balanceData?.success && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Reklama balansi</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatRub(balanceData.balance)}</p>
                {balanceData.bonus > 0 && (
                  <p className="text-xs text-muted-foreground">+{formatRub(balanceData.bonus)} bonus</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                <p className="text-[10px] text-muted-foreground">{formatRub(summary.totalSpent)}</p>
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
                {summary.totalSpent > 0 && summary.totalOrders > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    CPO: {formatRub(summary.totalSpent / summary.totalOrders)}
                  </p>
                )}
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
                      {/* CPM & Budget controls */}
                      <div className="flex gap-3 mt-2 flex-wrap">
                        {c.cpm > 0 && (
                          <button
                            onClick={() => { setEditDialog({ type: 'cpm', advertId: c.advertId, currentValue: c.cpm, campaignName: c.name || `#${c.advertId}` }); setEditValue(String(c.cpm)); }}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                          >
                            <Settings2 className="h-3 w-3" />
                            CPM: {formatRub(c.cpm)}
                          </button>
                        )}
                        <button
                          onClick={() => { setEditDialog({ type: 'budget', advertId: c.advertId, currentValue: c.dailyBudget || 0, campaignName: c.name || `#${c.advertId}` }); setEditValue(String(c.dailyBudget || 0)); }}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                        >
                          <Wallet className="h-3 w-3" />
                          Kunlik: {c.dailyBudget ? formatRub(c.dailyBudget) : '—'}
                        </button>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-1">
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

      {/* Edit CPM/Budget Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editDialog?.type === 'cpm' ? 'CPM stavkasini o\'zgartirish' : 'Kunlik byudjetni o\'zgartirish'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{editDialog?.campaignName}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={editDialog?.type === 'cpm' ? 'CPM (₽)' : 'Byudjet (₽)'}
                min={1}
              />
              <span className="text-sm text-muted-foreground shrink-0">₽</span>
            </div>
            {editValue && Number(editValue) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatMoney(Number(editValue))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Bekor</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
