import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Eye, ShoppingCart, Package, TrendingUp, RefreshCw, ArrowRight, AlertTriangle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toDisplayUzs, formatUzs, isRubMarketplace, rubToUzs } from '@/lib/currency';
import { useQuery } from '@tanstack/react-query';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo, MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { isExcludedOrder } from '@/lib/revenueCalculations';

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
const fmtSom = (n: number) => formatUzs(n) + " so'm";

export function MarketplaceSellerAnalytics({ connectedMarketplaces, store }: Props) {
  const [selectedMp, setSelectedMp] = useState<string>('all');
  const [period, setPeriod] = useState(7);

  // WB-specific seller analytics (requires WB Jam)
  const hasWB = connectedMarketplaces.includes('wildberries');
  const { data: wbData, isLoading: wbLoading, refetch: wbRefetch, isFetching: wbFetching } = useQuery({
    queryKey: ['wb-seller-analytics', period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace: 'wildberries', dataType: 'seller-analytics', period },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasWB && (selectedMp === 'all' || selectedMp === 'wildberries'),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Build universal analytics from store data
  const analytics = useMemo(() => {
    const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];
    const now = new Date();
    const periodStart = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);

    const result: Record<string, {
      marketplace: string;
      totalOrders: number;
      totalRevenue: number;
      totalProducts: number;
      avgOrderValue: number;
      topProducts: Array<{ name: string; offerId: string; photo?: string; orders: number; revenue: number; stock: number }>;
    }> = {};

    for (const mp of mpList) {
      const orders = store.getOrders(mp).filter(o => {
        if (isExcludedOrder(o)) return false;
        const d = new Date(o.createdAt);
        return d >= periodStart && d <= now;
      });
      const products = store.getProducts(mp);

      // Count orders per product
      const productOrderMap = new Map<string, { count: number; revenue: number }>();
      for (const o of orders) {
        const key = o.items?.[0]?.offerId || String(o.id);
        const prev = productOrderMap.get(key) || { count: 0, revenue: 0 };
        const qty = o.items?.reduce((s, i) => s + i.count, 0) || 1;
        prev.count += qty;
        prev.revenue += toDisplayUzs(o.total || 0, mp);
        productOrderMap.set(key, prev);
      }

      const totalRevenue = orders.reduce((s, o) => s + toDisplayUzs(o.total || 0, mp), 0);
      const totalOrders = orders.length;

      const topProducts = products
        .map(p => {
          const orderData = productOrderMap.get(p.offerId) || { count: 0, revenue: 0 };
          return {
            name: p.name,
            offerId: p.offerId,
            photo: p.pictures?.[0],
            orders: orderData.count,
            revenue: orderData.revenue,
            stock: (p.stockFBO || 0) + (p.stockFBS || 0),
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 15);

      result[mp] = {
        marketplace: mp,
        totalOrders,
        totalRevenue,
        totalProducts: products.length,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        topProducts,
      };
    }

    // Aggregate totals
    const allMps = Object.values(result);
    return {
      byMarketplace: result,
      total: {
        orders: allMps.reduce((s, m) => s + m.totalOrders, 0),
        revenue: allMps.reduce((s, m) => s + m.totalRevenue, 0),
        products: allMps.reduce((s, m) => s + m.totalProducts, 0),
        avgOrderValue: allMps.reduce((s, m) => s + m.totalOrders, 0) > 0
          ? allMps.reduce((s, m) => s + m.totalRevenue, 0) / allMps.reduce((s, m) => s + m.totalOrders, 0)
          : 0,
      },
    };
  }, [connectedMarketplaces, selectedMp, period, store.dataVersion]);

  const isLoading = store.isLoadingProducts || store.isLoadingOrders;
  const wbSummary = wbData?.summary;
  const wbCards = wbData?.data || [];
  const showWBExtended = (selectedMp === 'all' || selectedMp === 'wildberries') && hasWB && wbSummary;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />Sotuvchi analitikasi
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
        </div>
      </div>

      {/* Marketplace filter */}
      <MarketplaceFilterBar
        connectedMarketplaces={connectedMarketplaces}
        selectedMp={selectedMp}
        onSelect={setSelectedMp}
      />

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ShoppingCart className="h-3.5 w-3.5" /><span className="text-xs">Buyurtmalar</span>
              </div>
              <p className="text-xl font-bold">{fmt(analytics.total.orders)}</p>
              <p className="text-[11px] text-muted-foreground">{period} kun ichida</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" /><span className="text-xs">Daromad</span>
              </div>
              <p className="text-xl font-bold text-primary">{fmtSom(analytics.total.revenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Package className="h-3.5 w-3.5" /><span className="text-xs">Mahsulotlar</span>
              </div>
              <p className="text-xl font-bold">{analytics.total.products}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <BarChart3 className="h-3.5 w-3.5" /><span className="text-xs">O'rtacha chek</span>
              </div>
              <p className="text-xl font-bold">{fmtSom(analytics.total.avgOrderValue)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WB Extended Analytics (Jam) */}
      {showWBExtended && (
        <Card className="border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MarketplaceLogo marketplace="wildberries" size={18} />
              <span className="text-sm font-semibold">WB kengaytirilgan analitika</span>
              <Badge variant="secondary" className="text-[10px]">Jam</Badge>
              <Button size="icon" variant="ghost" onClick={() => wbRefetch()} disabled={wbFetching} className="ml-auto h-7 w-7">
                <RefreshCw className={cn("h-3.5 w-3.5", wbFetching && "animate-spin")} />
              </Button>
            </div>
            {/* Funnel */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(wbSummary.totalViews)} ko'rish</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{fmt(wbSummary.totalAddToCart)} savat</span>
              <Badge variant="secondary" className="text-[10px]">{wbSummary.avgConversionToCart?.toFixed(1)}%</Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="flex items-center gap-1"><Package className="h-3 w-3" />{fmt(wbSummary.totalOrders)} buyurtma</span>
              <Badge variant="secondary" className="text-[10px]">{wbSummary.avgConversionToOrder?.toFixed(1)}%</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-marketplace breakdown */}
      {selectedMp === 'all' && connectedMarketplaces.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {connectedMarketplaces.map(mp => {
            const mpData = analytics.byMarketplace[mp];
            if (!mpData) return null;
            return (
              <Card key={mp}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MarketplaceLogo marketplace={mp} size={18} />
                    <span className="text-sm font-semibold">{MARKETPLACE_CONFIG[mp]?.name || mp}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Buyurtmalar:</span> <strong>{mpData.totalOrders}</strong></div>
                    <div><span className="text-muted-foreground">Daromad:</span> <strong className="text-primary">{fmtSom(mpData.totalRevenue)}</strong></div>
                    <div><span className="text-muted-foreground">Mahsulotlar:</span> <strong>{mpData.totalProducts}</strong></div>
                    <div><span className="text-muted-foreground">O'rt. chek:</span> <strong>{fmtSom(mpData.avgOrderValue)}</strong></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Top Products */}
      <h3 className="text-sm font-semibold mt-2">Top mahsulotlar (daromad bo'yicha)</h3>
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];
            const allTop = mpList.flatMap(mp =>
              (analytics.byMarketplace[mp]?.topProducts || []).map(p => ({ ...p, marketplace: mp }))
            ).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

            if (allTop.length === 0) return (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Ma'lumot topilmadi</CardContent></Card>
            );

            return allTop.map((item, idx) => (
              <Card key={`${item.marketplace}-${item.offerId}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
                  {item.photo && <img src={item.photo} alt="" className="h-10 w-10 rounded object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <MarketplaceLogo marketplace={item.marketplace} size={12} />
                      <span>📦 {item.orders} ta</span>
                      <span>💰 {fmtSom(item.revenue)}</span>
                      <span>📊 Zaxira: {item.stock}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ));
          })()}
        </div>
      )}

      {/* WB Top cards from API */}
      {showWBExtended && wbCards.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mt-4 flex items-center gap-2">
            <MarketplaceLogo marketplace="wildberries" size={14} />
            WB kartochka statistikasi (Jam)
          </h3>
          <div className="space-y-2">
            {wbCards.slice(0, 10).map((card: any, idx: number) => (
              <Card key={card.nmID || idx}>
                <CardContent className="p-3 flex items-center gap-3">
                  {card.photo && <img src={card.photo} alt="" className="h-10 w-10 rounded object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.title || card.vendorCode}</p>
                    <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                      <span>👁 {card.openCardCount}</span>
                      <span>🛒 {card.addToCartCount}</span>
                      <span>📦 {card.ordersCount}</span>
                      <span>💰 {formatUzs(rubToUzs(card.ordersSumRub))} so'm</span>
                    </div>
                  </div>
                  <Badge variant={card.conversions?.addToCartPercent > 5 ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {card.conversions?.addToCartPercent?.toFixed(1)}%
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
