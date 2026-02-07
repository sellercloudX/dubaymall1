import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign, TrendingUp, TrendingDown,
  Wallet, Receipt, RefreshCw, Calculator, Percent
} from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface FinancialDashboardProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
  monthlyFee?: number;
  commissionPercent?: number;
}

const USD_TO_UZS = 12800;

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
};

export function FinancialDashboard({ 
  connectedMarketplaces, store, monthlyFee = 499, commissionPercent = 4
}: FinancialDashboardProps) {
  const isLoading = store.isLoadingOrders;

  const summary = useMemo(() => {
    if (isLoading) return null;

    const marketplaceBreakdown = connectedMarketplaces.map(marketplace => {
      const orders = store.getOrders(marketplace);
      const mpRevenue = orders.reduce((sum, order) => sum + (order.totalUZS || order.total || 0), 0);
      const mpOrders = orders.length;
      return {
        marketplace,
        revenue: mpRevenue,
        orders: mpOrders,
        avgOrder: mpOrders > 0 ? Math.round(mpRevenue / mpOrders) : 0,
      };
    });

    const totalRevenue = marketplaceBreakdown.reduce((s, m) => s + m.revenue, 0);
    const totalOrders = marketplaceBreakdown.reduce((s, m) => s + m.orders, 0);
    const platformFee = monthlyFee * USD_TO_UZS;
    const commissionFee = totalRevenue * (commissionPercent / 100);
    const totalExpenses = platformFee + commissionFee;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue, totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      platformFee, commissionFee, totalExpenses, netProfit, profitMargin,
      marketplaceBreakdown,
    };
  }, [connectedMarketplaces, store.allOrders.length, isLoading, monthlyFee, commissionPercent]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    if (price >= 1000) return (price / 1000).toFixed(0) + ' ming';
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const formatFullPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(2) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Calculator className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Moliyaviy hisobotlar</h3>
        <p className="text-muted-foreground mb-4">Hisobotlarni ko'rish uchun avval marketplace ulang</p>
      </CardContent></Card>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 mb-2"><DollarSign className="h-4 w-4" /><span className="text-sm font-medium">Jami daromad</span></div>
            <div className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-2"><TrendingDown className="h-4 w-4" /><span className="text-sm font-medium">Jami xarajatlar</span></div>
            <div className="text-2xl font-bold">{formatPrice(summary.totalExpenses)}</div>
            <div className="text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${summary.netProfit >= 0 ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20' : 'from-orange-500/10 to-orange-500/5 border-orange-500/20'}`}>
          <CardContent className="pt-4">
            <div className={`flex items-center gap-2 ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'} mb-2`}>
              {summary.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-sm font-medium">Sof foyda</span>
            </div>
            <div className="text-2xl font-bold">{formatPrice(summary.netProfit)}</div>
            <div className="text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><Percent className="h-4 w-4" /><span className="text-sm font-medium">Foyda marjasi</span></div>
            <div className={`text-2xl font-bold ${summary.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{summary.profitMargin.toFixed(1)}%</div>
            <Progress value={Math.max(0, Math.min(100, summary.profitMargin))} className="h-1 mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Xarajatlar tarkibi</CardTitle>
            <CardDescription>SellerCloudX platformasi to'lovlari</CardDescription></div>
            <Button variant="outline" size="sm" onClick={() => store.refetchOrders()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${store.isFetching ? 'animate-spin' : ''}`} />Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Wallet className="h-5 w-5 text-blue-500" /></div>
                <div><div className="font-medium">Oylik abonent to'lovi</div><div className="text-sm text-muted-foreground">${monthlyFee}/oy</div></div>
              </div>
              <div className="text-right"><div className="font-bold">{formatFullPrice(summary.platformFee)}</div><div className="text-xs text-muted-foreground">Sobit to'lov</div></div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Percent className="h-5 w-5 text-amber-500" /></div>
                <div><div className="font-medium">Savdodan komissiya</div><div className="text-sm text-muted-foreground">{commissionPercent}% × {formatFullPrice(summary.totalRevenue)}</div></div>
              </div>
              <div className="text-right"><div className="font-bold">{formatFullPrice(summary.commissionFee)}</div><div className="text-xs text-muted-foreground">O'zgaruvchan to'lov</div></div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border-2 border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Calculator className="h-5 w-5 text-primary" /></div>
                <div><div className="font-medium">Jami xarajatlar</div><div className="text-sm text-muted-foreground">Platforma to'lovlari</div></div>
              </div>
              <div className="text-right"><div className="text-xl font-bold text-primary">{formatFullPrice(summary.totalExpenses)}</div></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Marketplace bo'yicha daromad</CardTitle><CardDescription>Har bir marketplace uchun moliyaviy ko'rsatkichlar</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary.marketplaceBreakdown.map((mp) => {
              const percentage = summary.totalRevenue > 0 ? (mp.revenue / summary.totalRevenue) * 100 : 0;
              return (
                <div key={mp.marketplace} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                        {mp.marketplace === 'yandex' ? '🟡' : mp.marketplace === 'uzum' ? '🟣' : '📦'}
                      </div>
                      <div><div className="font-medium">{MARKETPLACE_NAMES[mp.marketplace]}</div><div className="text-xs text-muted-foreground">{mp.orders} buyurtma</div></div>
                    </div>
                    <div className="text-right"><div className="font-bold">{formatFullPrice(mp.revenue)}</div><div className="text-xs text-muted-foreground">O'rtacha: {formatFullPrice(mp.avgOrder)}</div></div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <div className="text-xs text-right text-muted-foreground">{percentage.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center"><div className="text-sm text-muted-foreground mb-1">Jami savdo hajmi</div><div className="text-3xl font-bold text-green-600">{formatFullPrice(summary.totalRevenue)}</div></div>
            <div className="text-center"><div className="text-sm text-muted-foreground mb-1">SellerCloudX to'lovi</div><div className="text-3xl font-bold text-red-600">-{formatFullPrice(summary.totalExpenses)}</div></div>
            <div className="text-center"><div className="text-sm text-muted-foreground mb-1">Sizning sof foydangiz</div>
              <div className={`text-3xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {summary.netProfit >= 0 ? '+' : ''}{formatFullPrice(summary.netProfit)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
