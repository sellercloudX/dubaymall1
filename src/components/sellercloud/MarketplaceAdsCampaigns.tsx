import { useState, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Megaphone, Play, Pause, Eye, MousePointerClick, ShoppingCart, DollarSign, RefreshCw, TrendingUp, Wallet, Settings2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toDisplayUzs, formatUzs, isRubMarketplace, rubToUzs, getCurrencySymbol } from '@/lib/currency';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo, MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';

const UzumBoostManagerLazy = lazy(() => import('@/components/sellercloud/UzumBoostManager'));

interface Props {
  connectedMarketplaces: string[];
}

export function MarketplaceAdsCampaigns({ connectedMarketplaces }: Props) {
  const queryClient = useQueryClient();
  const [selectedMp, setSelectedMp] = useState<string>(() => {
    // Default to first marketplace that supports ads
    if (connectedMarketplaces.includes('wildberries')) return 'wildberries';
    return connectedMarketplaces[0] || 'wildberries';
  });
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState<{
    type: 'budget' | 'cpm';
    advertId: number;
    currentValue: number;
    campaignName: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const hasSelectedMp = connectedMarketplaces.includes(selectedMp);
  const adsSupported = selectedMp === 'wildberries' || selectedMp === 'uzum'; // WB has ads API, Uzum has Boost

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['marketplace-ads', selectedMp],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: selectedMp, dataType: 'ads-campaigns' },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasSelectedMp && adsSupported,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['marketplace-ads-balance', selectedMp],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: selectedMp, dataType: 'ads-balance' },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasSelectedMp && adsSupported,
    staleTime: 1000 * 60 * 10,
  });

  const handleAction = async (advertId: number, action: 'ads-pause' | 'ads-start') => {
    setActioningId(advertId);
    try {
      const { error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: selectedMp, dataType: action, advertId },
      });
      if (error) throw error;
      toast.success(action === 'ads-pause' ? 'Kampaniya to\'xtatildi' : 'Kampaniya ishga tushirildi');
      queryClient.invalidateQueries({ queryKey: ['marketplace-ads', selectedMp] });
    } catch {
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
      const body: any = { marketplace: selectedMp, dataType, advertId: editDialog.advertId };
      if (editDialog.type === 'budget') body.dailyBudget = numValue;
      else body.cpm = numValue;

      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', { body });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      
      toast.success(editDialog.type === 'budget' ? 'Byudjet yangilandi' : 'CPM stavka yangilandi');
      queryClient.invalidateQueries({ queryKey: ['marketplace-ads', selectedMp] });
      setEditDialog(null);
    } catch (e: any) {
      toast.error(e?.message || 'Xato yuz berdi');
    } finally {
      setEditLoading(false);
    }
  };

  const campaigns = data?.data || [];
  const summary = data?.summary;
  const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
  const fmtMoney = (n: number) => formatUzs(toDisplayUzs(n, selectedMp)) + " so'm";
  const fmtNative = (n: number) => `${Math.round(n).toLocaleString()} ${getCurrencySymbol(selectedMp)}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />Reklama kampaniyalari
        </h2>
        {adsSupported && (
          <Button size="icon" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Marketplace filter */}
      <MarketplaceFilterBar
        connectedMarketplaces={connectedMarketplaces}
        selectedMp={selectedMp}
        onSelect={setSelectedMp}
        showAll={false}
      />

      {/* Not supported message */}
      {!adsSupported && (
        <Card className="border-amber-500/20">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="font-medium">Reklama API hozircha mavjud emas</p>
            <p className="text-sm text-muted-foreground mt-1">
              {MARKETPLACE_CONFIG[selectedMp]?.name || selectedMp} uchun reklama boshqaruvi tez orada qo'shiladi.
              Hozircha Wildberries va Uzum reklama boshqaruvini qo'llab-quvvatlaydi.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Uzum Boost Manager */}
      {selectedMp === 'uzum' && hasSelectedMp && (
        <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
          <UzumBoostManagerLazy />
        </Suspense>
      )}

      {adsSupported && selectedMp !== 'uzum' && (
        <>
          {/* Ads Balance */}
          {balanceData?.success && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Reklama balansi</span>
                    <MarketplaceLogo marketplace={selectedMp} size={16} />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{fmtNative(balanceData.balance)}</p>
                    <p className="text-xs text-muted-foreground">≈ {fmtMoney(balanceData.balance)}</p>
                    {balanceData.bonus > 0 && (
                      <p className="text-xs text-muted-foreground">+{fmtNative(balanceData.bonus)} bonus</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Megaphone className="h-3.5 w-3.5" /><span className="text-xs">Kampaniyalar</span>
                    </div>
                    <p className="text-xl font-bold">{summary.total}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="default" className="text-[10px]">{summary.active} faol</Badge>
                      <Badge variant="secondary" className="text-[10px]">{summary.paused} pauza</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <DollarSign className="h-3.5 w-3.5" /><span className="text-xs">Xarajat (7 kun)</span>
                    </div>
                    <p className="text-xl font-bold">{fmtMoney(summary.totalSpent)}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtNative(summary.totalSpent)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Eye className="h-3.5 w-3.5" /><span className="text-xs">Ko'rishlar</span>
                    </div>
                    <p className="text-xl font-bold">{formatNum(summary.totalViews)}</p>
                    <p className="text-[11px] text-muted-foreground">{formatNum(summary.totalClicks)} bosish</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <ShoppingCart className="h-3.5 w-3.5" /><span className="text-xs">Buyurtmalar</span>
                    </div>
                    <p className="text-xl font-bold">{summary.totalOrders}</p>
                    {summary.totalSpent > 0 && summary.totalOrders > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        CPO: {fmtNative(summary.totalSpent / summary.totalOrders)}
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
                          </div>
                          {c.stats && (
                            <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{formatNum(c.stats.views)}</span>
                              <span className="flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" />{formatNum(c.stats.clicks)}</span>
                              <span className="flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />CTR {c.stats.ctr?.toFixed(2)}%</span>
                              <span className="flex items-center gap-0.5"><ShoppingCart className="h-3 w-3" />{c.stats.orders}</span>
                              <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" />{fmtMoney(c.stats.sum)}</span>
                            </div>
                          )}
                          <div className="flex gap-3 mt-2 flex-wrap">
                            {c.cpm > 0 && (
                              <button
                                onClick={() => { setEditDialog({ type: 'cpm', advertId: c.advertId, currentValue: c.cpm, campaignName: c.name || `#${c.advertId}` }); setEditValue(String(c.cpm)); }}
                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                              >
                                <Settings2 className="h-3 w-3" />CPM: {fmtNative(c.cpm)}
                              </button>
                            )}
                            <button
                              onClick={() => { setEditDialog({ type: 'budget', advertId: c.advertId, currentValue: c.dailyBudget || 0, campaignName: c.name || `#${c.advertId}` }); setEditValue(String(c.dailyBudget || 0)); }}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                            >
                              <Wallet className="h-3 w-3" />Kunlik: {c.dailyBudget ? fmtNative(c.dailyBudget) : '—'}
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
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Kampaniyalar topilmadi</CardContent></Card>
                )}
              </div>
            </>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Ma'lumot topilmadi</CardContent></Card>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editDialog?.type === 'cpm' ? 'CPM stavkasini o\'zgartirish' : 'Kunlik byudjetni o\'zgartirish'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{editDialog?.campaignName}</p>
            <div className="flex items-center gap-2">
              <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} min={1} />
              <span className="text-sm text-muted-foreground shrink-0">{getCurrencySymbol(selectedMp)}</span>
            </div>
            {editValue && Number(editValue) > 0 && (
              <p className="text-xs text-muted-foreground">≈ {fmtMoney(Number(editValue))}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Bekor</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
