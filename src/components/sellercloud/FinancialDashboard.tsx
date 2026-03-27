import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketplaceLogo, MARKETPLACE_SHORT_NAMES } from '@/lib/marketplaceConfig';
import { toDisplayUzs } from '@/lib/currency';
import { getMarketplaceOrderStatusCategory } from '@/lib/marketplaceOrderStatus';
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
import { DateRangeFilter, getPresetDates, type DatePreset } from './DateRangeFilter';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface FinancialDashboardProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}


const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market', uzum: 'Uzum Market', wildberries: 'WB', ozon: 'Ozon',
};

const MARKETPLACE_FEE_LABELS: Record<string, string> = {
  yandex: 'Yandex komissiya + logistika',
  uzum: 'Uzum komissiya + logistika',
  wildberries: 'WB xizmat haqi',
  ozon: 'Ozon xizmat haqi',
};

const MARKETPLACE_FEE_DETAILS: Record<string, string> = {
  yandex: 'API orqali real tarif',
  uzum: 'Komissiya (10-20%) + logistika (4-20k)',
  wildberries: 'API orqali real komissiya + logistika',
};

// O'zbekiston YATT solig'i — barcha marketplace'lar uchun 4%
const UZB_TAX_RATE = 0.04;

export function FinancialDashboard({ 
  connectedMarketplaces, store
}: FinancialDashboardProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(getPresetDates('30d').from);
  const [dateTo, setDateTo] = useState<Date | undefined>(getPresetDates('30d').to);
  const [selectedMp, setSelectedMp] = useState<string>('all');

  const isLoading = store.isLoadingOrders;
  const { getCostPrice } = useCostPrices();
  const { data: tariffMap, isLoading: tariffsLoading, dataUpdatedAt: tariffUpdatedAt } = useMarketplaceTariffs(connectedMarketplaces, store);

  const activeMarketplaces = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];

  const summary = useMemo(() => {
    if (isLoading) return null;

    let totalProductCost = 0;
    let costPricesCovered = 0;
    let totalProductCount = 0;
    let totalMarketplaceFees = 0;
    let realTariffCount = 0;
    let totalItemRevenue = 0;
    let totalWbSppAmount = 0;
    let totalWbForPay = 0;

    const feesByMarketplace: Record<string, { fees: number; feePercent: string; revenue: number; orders: number; sppAmount: number; forPayTotal: number; hasRealTariffs: boolean }> = {};

    const marketplaceBreakdown = activeMarketplaces.map(marketplace => {
      const orders = store.getOrders(marketplace);
      const activeOrders = orders.filter(o => {
        if (getMarketplaceOrderStatusCategory(o, marketplace) === 'cancelled') return false;
        if (dateFrom || dateTo) {
          const orderDate = new Date(o.createdAt);
          if (dateFrom && orderDate < dateFrom) return false;
          if (dateTo && orderDate > dateTo) return false;
        }
        return true;
      });
      
      let mpRevenue = 0;
      let mpFees = 0;
      let mpSpp = 0;
      let mpForPay = 0;
      let mpRealTariffCount = 0;
      let mpItemCount = 0;

      activeOrders.forEach(order => {
        (order.items || []).forEach(item => {
          const cost = getCostPrice(marketplace, item.offerId);
          const qty = item.count || 1;
          const itemPrice = toDisplayUzs(item.price || 0, marketplace);
          const itemRevenue = itemPrice * qty;
          totalProductCount += qty;
          mpItemCount += qty;
          mpRevenue += itemRevenue;
          
          if (cost !== null) {
            totalProductCost += toDisplayUzs(cost, marketplace) * qty;
            costPricesCovered += qty;
          }

          const commBase = (item as any).commissionBase ? toDisplayUzs((item as any).commissionBase, marketplace) : undefined;
          const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice, marketplace, commBase);
          const itemFees = tariff.totalFee * qty;
          mpFees += itemFees;
          totalMarketplaceFees += itemFees;
          if (tariff.isReal) {
            realTariffCount += qty;
            mpRealTariffCount += qty;
          }

          // WB SPP: WB discount to buyer (seller bears cost)
          if (marketplace === 'wildberries' && item.spp && item.spp > 0) {
            mpSpp += toDisplayUzs((item.price || 0) * item.spp / 100, 'wildberries') * qty;
          }
          if (marketplace === 'wildberries' && item.forPay && item.forPay > 0) {
            mpForPay += toDisplayUzs(item.forPay, 'wildberries') * qty;
          }
        });
      });

      totalItemRevenue += mpRevenue;
      totalWbSppAmount += mpSpp;
      totalWbForPay += mpForPay;

      feesByMarketplace[marketplace] = {
        fees: mpFees,
        feePercent: mpRevenue > 0 ? ((mpFees / mpRevenue) * 100).toFixed(1) : '0',
        revenue: mpRevenue,
        orders: activeOrders.length,
        sppAmount: mpSpp,
        forPayTotal: mpForPay,
        hasRealTariffs: mpItemCount > 0 && mpRealTariffCount > 0,
      };

      return {
        marketplace, revenue: mpRevenue, orders: activeOrders.length,
        avgOrder: activeOrders.length > 0 ? Math.round(mpRevenue / activeOrders.length) : 0,
      };
    });

    const totalRevenue = totalItemRevenue;
    const totalOrders = marketplaceBreakdown.reduce((s, m) => s + m.orders, 0);
    
    let totalTax = 0;
    activeMarketplaces.forEach(mp => {
      const taxRate = MARKETPLACE_TAX[mp] ?? 0;
      totalTax += (feesByMarketplace[mp]?.revenue || 0) * taxRate;
    });

    const totalExpenses = totalProductCost + totalMarketplaceFees + totalTax;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const costCoverage = totalProductCount > 0 ? Math.round((costPricesCovered / totalProductCount) * 100) : 0;
    const tariffCoverage = totalProductCount > 0 ? Math.round((realTariffCount / totalProductCount) * 100) : 0;
    const feePercent = totalRevenue > 0 ? ((totalMarketplaceFees / totalRevenue) * 100).toFixed(1) : '0';
    const hasWbSpp = totalWbSppAmount > 0;
    const hasAnyRealTariffs = realTariffCount > 0;

    return { totalRevenue, totalOrders, totalMarketplaceFees, feePercent, totalTax, totalExpenses, netProfit, profitMargin, marketplaceBreakdown, totalProductCost, costCoverage, tariffCoverage, feesByMarketplace, hasWbSpp, totalWbSppAmount, totalWbForPay, hasAnyRealTariffs };
  }, [activeMarketplaces, store.dataVersion, isLoading, getCostPrice, tariffUpdatedAt, dateFrom, dateTo, selectedMp]);

  const formatPrice = (price: number) => {
    const rounded = Math.round(price);
    if (Math.abs(rounded) >= 1000000) return (Math.round(rounded / 100000) / 10).toFixed(1) + ' mln';
    if (Math.abs(rounded) >= 1000) return Math.round(rounded / 1000) + ' ming';
    return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(rounded);
  };

  const formatFullPrice = (price: number) => {
    const rounded = Math.round(price);
    if (Math.abs(rounded) >= 1000000) return (Math.round(rounded / 100000) / 10).toFixed(1) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(rounded) + ' so\'m';
  };

  if (connectedMarketplaces.length === 0) {
    return (<Card><CardContent className="py-12 text-center"><Calculator className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Moliyaviy hisobotlar</h3><p className="text-muted-foreground">Avval marketplace ulang</p></CardContent></Card>);
  }

  const tariffsPending = tariffsLoading || (!tariffMap && store.allProducts.length > 0);
  if (isLoading || tariffsPending || !summary) {
    return (<div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>);
  }

  const feeLabel = selectedMp !== 'all' 
    ? (MARKETPLACE_FEE_LABELS[selectedMp] || 'Xizmat haqi')
    : 'Marketplace xizmat haqi';

  return (
    <div className="space-y-4 md:space-y-6 overflow-hidden">
      {/* Marketplace Filter + Date Range */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:flex-wrap">
        <MarketplaceFilterBar
          connectedMarketplaces={connectedMarketplaces}
          selectedMp={selectedMp}
          onSelect={setSelectedMp}
        />
        <DateRangeFilter
          from={dateFrom} to={dateTo} activePreset={datePreset}
          onRangeChange={(f, t, p) => { setDateFrom(f); setDateTo(t); setDatePreset(p); }}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-1.5 text-primary mb-1 md:mb-2"><DollarSign className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" /><span className="text-xs md:text-sm font-medium truncate">Jami daromad</span></div>
            <div className="text-xl md:text-2xl font-bold truncate">{formatPrice(summary.totalRevenue)}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 overflow-hidden">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-1.5 text-destructive mb-1 md:mb-2"><TrendingDown className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" /><span className="text-xs md:text-sm font-medium truncate">Xarajatlar</span></div>
            <div className="text-xl md:text-2xl font-bold truncate">{formatPrice(summary.totalExpenses)}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className={`overflow-hidden bg-gradient-to-br ${summary.netProfit >= 0 ? 'from-primary/10 to-primary/5 border-primary/20' : 'from-destructive/10 to-destructive/5 border-destructive/20'}`}>
          <CardContent className="p-3 md:p-5">
            <div className={`flex items-center gap-1.5 ${summary.netProfit >= 0 ? 'text-primary' : 'text-destructive'} mb-1 md:mb-2`}>
              {summary.netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" /> : <TrendingDown className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" />}
              <span className="text-xs md:text-sm font-medium truncate">Sof foyda</span>
            </div>
            <div className="text-xl md:text-2xl font-bold truncate">{formatPrice(summary.netProfit)}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1 md:mb-2"><Percent className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" /><span className="text-xs md:text-sm font-medium truncate">Marja</span></div>
            <div className={`text-xl md:text-2xl font-bold ${summary.profitMargin >= 0 ? 'text-primary' : 'text-destructive'}`}>{summary.profitMargin.toFixed(1)}%</div>
            <Progress value={Math.max(0, Math.min(100, summary.profitMargin))} className="h-1 mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Expenses Breakdown */}
        <Card className="overflow-hidden">
          <CardHeader className="p-3 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base"><Receipt className="h-4 w-4 shrink-0" /><span className="truncate">Xarajatlar</span></CardTitle>
                <CardDescription className="text-xs truncate">
                  {selectedMp !== 'all' ? MARKETPLACE_NAMES[selectedMp] : 'Barcha marketplace'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => store.refetchOrders()} disabled={store.isFetching} className="shrink-0">
                <RefreshCw className={`h-4 w-4 ${store.isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0 space-y-3">
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

            {/* Marketplace Fees — shown per-marketplace when "all" */}
            {selectedMp === 'all' ? (
              activeMarketplaces.map(mp => {
                const mpData = summary.feesByMarketplace[mp];
                if (!mpData) return null;
                return (
                  <div key={mp} className="flex items-center justify-between p-3 rounded-lg border gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <span className="text-sm">{mp === 'yandex' ? '🟡' : mp === 'uzum' ? '🟣' : '📦'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          {MARKETPLACE_FEE_LABELS[mp] || `${mp} xizmat haqi`}
                          {mpData.hasRealTariffs ? (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />API
                            </Badge>
                          ) : mpData.fees > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />API
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground px-1.5 py-0">
                              Ma'lumot yo'q
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {mpData.fees > 0 ? `${mpData.feePercent}%` : 'API ulanmagan'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{mpData.fees > 0 ? formatFullPrice(mpData.fees) : '—'}</div></div>
                  </div>
                );
              })
            ) : (
              (() => {
                const mpData = summary.feesByMarketplace[selectedMp];
                const hasReal = mpData?.hasRealTariffs;
                return (
                  <div className="flex items-center justify-between p-3 rounded-lg border gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <span className="text-sm">{selectedMp === 'yandex' ? '🟡' : selectedMp === 'uzum' ? '🟣' : '📦'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          {feeLabel}
                          {hasReal || summary.totalMarketplaceFees > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />API
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground px-1.5 py-0">
                              Ma'lumot yo'q
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {(hasReal || summary.totalMarketplaceFees > 0) ? `${summary.feePercent}%` : 'API ulanmagan'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{summary.totalMarketplaceFees > 0 ? formatFullPrice(summary.totalMarketplaceFees) : '—'}</div></div>
                  </div>
                );
              })()
            )}

            {/* WB SPP (WB chegirma) — only show when data available */}
            {summary.hasWbSpp && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0"><Percent className="h-4 w-4 text-amber-600" /></div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">WB chegirma (SPP)</div>
                    <div className="text-xs text-muted-foreground">WB xaridor uchun chegirma — sotuvchi hisobidan</div>
                  </div>
                </div>
                <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap text-amber-600">{formatFullPrice(summary.totalWbSppAmount)}</div></div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg border gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><DollarSign className="h-4 w-4 text-muted-foreground" /></div>
                <div className="min-w-0"><div className="font-medium text-sm truncate">Soliq</div><div className="text-xs text-muted-foreground">4%</div></div>
              </div>
              <div className="text-right shrink-0"><div className="font-bold text-sm whitespace-nowrap">{formatFullPrice(summary.totalTax)}</div></div>
            </div>

            {/* Platform info */}

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
          <CardHeader className="p-3 md:p-6"><CardTitle className="text-sm md:text-base">Marketplace daromadi</CardTitle></CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0 space-y-4">
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
      </div>

      {/* Summary Banner */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-3 gap-3 md:gap-6 text-center">
            <div><div className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Savdo</div><div className="text-sm md:text-xl font-bold text-primary truncate">{formatFullPrice(summary.totalRevenue)}</div></div>
            <div><div className="text-[10px] md:text-xs text-muted-foreground mb-0.5">To'lov</div><div className="text-sm md:text-xl font-bold text-destructive truncate">-{formatFullPrice(summary.totalExpenses)}</div></div>
            <div><div className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Foyda</div>
              <div className={`text-sm md:text-xl font-bold truncate ${summary.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {summary.netProfit >= 0 ? '+' : ''}{formatFullPrice(summary.netProfit)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
