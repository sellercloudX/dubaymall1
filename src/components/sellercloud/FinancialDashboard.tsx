import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, TrendingUp, TrendingDown,
  Wallet, Receipt, RefreshCw, Calculator, Percent, Package, CheckCircle2
} from 'lucide-react';
import { useCostPrices } from '@/hooks/useCostPrices';
import { useMarketplaceTariffs, getTariffForProduct } from '@/hooks/useMarketplaceTariffs';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface FinancialDashboardProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
  monthlyFee?: number;
  commissionPercent?: number;
}

const USD_TO_UZS = 12800;

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market', uzum: 'Uzum Market', wildberries: 'Wildberries', ozon: 'Ozon',
};

export function FinancialDashboard({ 
  connectedMarketplaces, store, monthlyFee = 499, commissionPercent = 4
}: FinancialDashboardProps) {
  const isLoading = store.isLoadingOrders;
  const { getCostPrice } = useCostPrices();
  const { data: tariffMap, isLoading: tariffsLoading } = useMarketplaceTariffs(connectedMarketplaces, store);

  const summary = useMemo(() => {
    if (isLoading) return null;

    let totalProductCost = 0;
    let costPricesCovered = 0;
    let totalProductCount = 0;
    let totalYandexFees = 0;
    let realTariffCount = 0;
    let estimatedTariffCount = 0;

    const marketplaceBreakdown = connectedMarketplaces.map(marketplace => {
      const orders = store.getOrders(marketplace);
      const activeOrders = orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status));
      const mpRevenue = activeOrders.reduce((sum, order) => sum + (order.totalUZS || order.total || 0), 0);

      // Calculate real product costs and tariffs from order items
      activeOrders.forEach(order => {
        (order.items || []).forEach(item => {
          const cost = getCostPrice(marketplace, item.offerId);
          const qty = item.count || 1;
          const itemPrice = item.priceUZS || item.price || 0;
          totalProductCount += qty;
          
          if (cost !== null) {
            totalProductCost += cost * qty;
            costPricesCovered += qty;
          }

          // Real tariff per product
          const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice);
          totalYandexFees += tariff.totalFee * qty;
          if (tariff.isReal) realTariffCount += qty;
          else estimatedTariffCount += qty;
        });
      });

      return {
        marketplace, revenue: mpRevenue, orders: activeOrders.length,
        avgOrder: activeOrders.length > 0 ? Math.round(mpRevenue / activeOrders.length) : 0,
      };
    });

    const totalRevenue = marketplaceBreakdown.reduce((s, m) => s + m.revenue, 0);
    const totalOrders = marketplaceBreakdown.reduce((s, m) => s + m.orders, 0);
    const platformFee = monthlyFee * USD_TO_UZS;
    const platformCommission = totalRevenue * (commissionPercent / 100);
    const yandexTax = totalRevenue * 0.04;
    const totalExpenses = totalProductCost + platformFee + platformCommission + totalYandexFees + yandexTax;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const costCoverage = totalProductCount > 0 ? Math.round((costPricesCovered / totalProductCount) * 100) : 0;
    const tariffCoverage = totalProductCount > 0 ? Math.round((realTariffCount / totalProductCount) * 100) : 0;
    const yandexFeePercent = totalRevenue > 0 ? ((totalYandexFees / totalRevenue) * 100).toFixed(1) : '0';

    return { totalRevenue, totalOrders, platformFee, platformCommission, totalYandexFees, yandexFeePercent, yandexTax, totalExpenses, netProfit, profitMargin, marketplaceBreakdown, totalProductCost, costCoverage, tariffCoverage };
  }, [connectedMarketplaces, store.dataVersion, isLoading, monthlyFee, commissionPercent, getCostPrice, tariffMap]);

  const formatPrice = (price: number) => {
    if (Math.abs(price) >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    if (Math.abs(price) >= 1000) return (price / 1000).toFixed(0) + ' ming';
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const formatFullPrice = (price: number) => {
    if (Math.abs(price) >= 1000000) return (price / 1000000).toFixed(2) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  if (connectedMarketplaces.length === 0) {
    return (<Card><CardContent className="py-12 text-center"><Calculator className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Moliyaviy hisobotlar</h3><p className="text-muted-foreground">Avval marketplace ulang</p></CardContent></Card>);
  }

  if (isLoading || !summary) {
    return (<div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>);
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-primary mb-1"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span className="text-xs font-medium truncate">Jami daromad</span></div>
            <div className="text-xl font-bold truncate">{formatPrice(summary.totalRevenue)}</div>
            <div className="text-[10px] text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-destructive mb-1"><TrendingDown className="h-3.5 w-3.5 shrink-0" /><span className="text-xs font-medium truncate">Xarajatlar</span></div>
            <div className="text-xl font-bold truncate">{formatPrice(summary.totalExpenses)}</div>
            <div className="text-[10px] text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className={`overflow-hidden bg-gradient-to-br ${summary.netProfit >= 0 ? 'from-primary/10 to-primary/5 border-primary/20' : 'from-destructive/10 to-destructive/5 border-destructive/20'}`}>
          <CardContent className="p-3">
            <div className={`flex items-center gap-1.5 ${summary.netProfit >= 0 ? 'text-primary' : 'text-destructive'} mb-1`}>
              {summary.netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5 shrink-0" /> : <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
              <span className="text-xs font-medium truncate">Sof foyda</span>
            </div>
            <div className="text-xl font-bold truncate">{formatPrice(summary.netProfit)}</div>
            <div className="text-[10px] text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Percent className="h-3.5 w-3.5 shrink-0" /><span className="text-xs font-medium truncate">Marja</span></div>
            <div className={`text-xl font-bold ${summary.profitMargin >= 0 ? 'text-primary' : 'text-destructive'}`}>{summary.profitMargin.toFixed(1)}%</div>
            <Progress value={Math.max(0, Math.min(100, summary.profitMargin))} className="h-1 mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* Expenses Breakdown */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Receipt className="h-4 w-4 shrink-0" /><span className="truncate">Xarajatlar</span></CardTitle>
              <CardDescription className="text-xs truncate">Real tarif ma'lumotlari</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchOrders()} disabled={store.isFetching} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${store.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3">
          {/* Tannarx */}
          <div className="flex items-center justify-between p-3 rounded-lg border gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-destructive" /></div>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">Mahsulot tannarxi</div>
                <div className="text-xs text-muted-foreground">{summary.costCoverage}% mahsulotda kiritilgan</div>
              </div>
            </div>
            <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{formatFullPrice(summary.totalProductCost)}</div></div>
          </div>
          {/* Yandex Real Tariffs */}
          <div className="flex items-center justify-between p-3 rounded-lg border gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0"><Receipt className="h-4 w-4 text-secondary-foreground" /></div>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate flex items-center gap-1.5">
                  Yandex xizmat haqi
                  {summary.tariffCoverage > 0 && (
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Real
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  ~{summary.yandexFeePercent}% (komissiya + logistika)
                </div>
              </div>
            </div>
            <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{formatFullPrice(summary.totalYandexFees)}</div></div>
          </div>
          {/* Tax */}
          <div className="flex items-center justify-between p-3 rounded-lg border gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><DollarSign className="h-4 w-4 text-muted-foreground" /></div>
              <div className="min-w-0"><div className="font-medium text-sm truncate">Soliq</div><div className="text-xs text-muted-foreground">4%</div></div>
            </div>
            <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{formatFullPrice(summary.yandexTax)}</div></div>
          </div>
          {/* Platform fees */}
          <div className="flex items-center justify-between p-3 rounded-lg border gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Wallet className="h-4 w-4 text-primary" /></div>
              <div className="min-w-0"><div className="font-medium text-sm truncate">SellerCloudX</div><div className="text-xs text-muted-foreground">${monthlyFee}/oy + {commissionPercent}%</div></div>
            </div>
            <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{formatFullPrice(summary.platformFee + summary.platformCommission)}</div></div>
          </div>
          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border-2 border-primary/20 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Calculator className="h-4 w-4 text-primary" /></div>
              <div className="min-w-0"><div className="font-medium text-sm truncate">Jami xarajat</div></div>
            </div>
            <div className="text-right shrink-0"><div className="text-lg font-bold text-primary whitespace-nowrap">{formatFullPrice(summary.totalExpenses)}</div></div>
          </div>
        </CardContent>
      </Card>

      {/* Marketplace Breakdown */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">Marketplace daromadi</CardTitle></CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-4">
          {summary.marketplaceBreakdown.map((mp) => {
            const percentage = summary.totalRevenue > 0 ? (mp.revenue / summary.totalRevenue) * 100 : 0;
            return (
              <div key={mp.marketplace} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{mp.marketplace === 'yandex' ? '🟡' : mp.marketplace === 'uzum' ? '🟣' : '📦'}</span>
                    <div className="min-w-0"><div className="font-medium text-sm truncate">{MARKETPLACE_NAMES[mp.marketplace]}</div><div className="text-xs text-muted-foreground">{mp.orders} buyurtma</div></div>
                  </div>
                  <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{formatFullPrice(mp.revenue)}</div></div>
                </div>
                <Progress value={percentage} className="h-1.5" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary Banner */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-[10px] text-muted-foreground mb-0.5">Savdo</div><div className="text-sm sm:text-lg font-bold text-primary truncate">{formatFullPrice(summary.totalRevenue)}</div></div>
            <div><div className="text-[10px] text-muted-foreground mb-0.5">To'lov</div><div className="text-sm sm:text-lg font-bold text-destructive truncate">-{formatFullPrice(summary.totalExpenses)}</div></div>
            <div><div className="text-[10px] text-muted-foreground mb-0.5">Foyda</div>
              <div className={`text-sm sm:text-lg font-bold truncate ${summary.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {summary.netProfit >= 0 ? '+' : ''}{formatFullPrice(summary.netProfit)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
