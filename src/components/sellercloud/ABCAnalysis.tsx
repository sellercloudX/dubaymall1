import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  Package, RefreshCw, ArrowUpRight, ArrowDownRight,
  Calculator
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface ABCAnalysisProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
  commissionPercent?: number;
}

interface ProductPnL {
  id: string; name: string; sku: string; marketplace: string;
  price: number; totalSold: number; totalRevenue: number;
  estimatedCost: number; commissionAmount: number; logisticsCost: number;
  netProfit: number; profitMargin: number;
  abcGroup: 'A' | 'B' | 'C'; revenueShare: number;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex', uzum: 'Uzum', wildberries: 'WB', ozon: 'Ozon',
};

const ABC_COLORS = {
  A: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30', badge: 'bg-green-500' },
  B: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30', badge: 'bg-amber-500' },
  C: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30', badge: 'bg-red-500' },
};

export function ABCAnalysis({ connectedMarketplaces, store, commissionPercent = 4 }: ABCAnalysisProps) {
  const [selectedGroup, setSelectedGroup] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const isMobile = useIsMobile();
  const isLoading = store.isLoading;

  const products = useMemo(() => {
    if (isLoading) return [];
    const allProducts: ProductPnL[] = [];

    for (const marketplace of connectedMarketplaces) {
      const productsList = store.getProducts(marketplace);
      const orders = store.getOrders(marketplace);

      const salesMap = new Map<string, { qty: number; revenue: number }>();
      orders.forEach(order => {
        (order.items || []).forEach(item => {
          const key = item.offerId;
          if (!key) return;
          const existing = salesMap.get(key) || { qty: 0, revenue: 0 };
          existing.qty += item.count || 1;
          existing.revenue += item.priceUZS || item.price || 0;
          salesMap.set(key, existing);
        });
      });

      if (salesMap.size === 0 && orders.length > 0) {
        const totalOrderRevenue = orders.reduce((s, o) => s + (o.totalUZS || o.total || 0), 0);
        productsList.forEach(p => {
          salesMap.set(p.offerId, {
            qty: Math.max(1, Math.floor(orders.length / Math.max(1, productsList.length))),
            revenue: Math.round(totalOrderRevenue / Math.max(1, productsList.length)),
          });
        });
      }

      productsList.forEach(product => {
        const sales = salesMap.get(product.offerId) || { qty: 0, revenue: 0 };
        const price = product.price || 0;
        const totalRevenue = sales.revenue || sales.qty * price;
        const estimatedCost = totalRevenue * 0.6;
        const commissionAmount = totalRevenue * (commissionPercent / 100);
        const logisticsCost = totalRevenue * 0.05;
        const netProfit = totalRevenue - estimatedCost - commissionAmount - logisticsCost;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        allProducts.push({
          id: product.offerId, name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId, marketplace, price,
          totalSold: sales.qty, totalRevenue, estimatedCost,
          commissionAmount, logisticsCost, netProfit, profitMargin,
          abcGroup: 'C', revenueShare: 0,
        });
      });
    }

    allProducts.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const totalRevenue = allProducts.reduce((s, p) => s + p.totalRevenue, 0);
    let cumulativeShare = 0;
    allProducts.forEach(product => {
      product.revenueShare = totalRevenue > 0 ? (product.totalRevenue / totalRevenue) * 100 : 0;
      cumulativeShare += product.revenueShare;
      if (cumulativeShare <= 80) product.abcGroup = 'A';
      else if (cumulativeShare <= 95) product.abcGroup = 'B';
      else product.abcGroup = 'C';
    });

    return allProducts;
  }, [connectedMarketplaces, store.allProducts.length, store.allOrders.length, isLoading, commissionPercent]);

  const formatPrice = (price: number) => {
    if (Math.abs(price) >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    if (Math.abs(price) >= 1000) return (price / 1000).toFixed(0) + ' ming';
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const grouped = useMemo(() => ({
    A: products.filter(p => p.abcGroup === 'A'),
    B: products.filter(p => p.abcGroup === 'B'),
    C: products.filter(p => p.abcGroup === 'C'),
  }), [products]);

  const filteredProducts = selectedGroup === 'all' ? products : grouped[selectedGroup];
  const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
  const totalProfit = products.reduce((s, p) => s + p.netProfit, 0);
  const profitableCount = products.filter(p => p.netProfit > 0).length;
  const unprofitableCount = products.filter(p => p.netProfit <= 0).length;

  if (connectedMarketplaces.length === 0) {
    return (<Card><CardContent className="py-12 text-center"><BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">ABC-analiz & PnL</h3><p className="text-muted-foreground">Avval marketplace ulang</p></CardContent></Card>);
  }

  if (isLoading) {
    return (<div className="space-y-4"><div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>);
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-green-600 mb-1"><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /><span className="text-xs font-medium truncate">Foydali</span></div>
            <div className="text-xl font-bold">{profitableCount}</div><div className="text-[10px] text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-red-600 mb-1"><ArrowDownRight className="h-3.5 w-3.5 shrink-0" /><span className="text-xs font-medium truncate">Zarardagi</span></div>
            <div className="text-xl font-bold">{unprofitableCount}</div><div className="text-[10px] text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span className="text-xs font-medium truncate">Jami daromad</span></div>
            <div className="text-xl font-bold truncate">{formatPrice(totalRevenue)}</div><div className="text-[10px] text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className={`overflow-hidden ${totalProfit >= 0 ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20' : 'bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20'}`}>
          <CardContent className="p-3">
            <div className={`flex items-center gap-1.5 mb-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {totalProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5 shrink-0" /> : <TrendingDown className="h-3.5 w-3.5 shrink-0" />}<span className="text-xs font-medium truncate">Sof foyda</span>
            </div>
            <div className="text-xl font-bold truncate">{formatPrice(totalProfit)}</div><div className="text-[10px] text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
      </div>

      {/* ABC Groups */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2" style={{ minWidth: isMobile ? '600px' : 'auto' }}>
          {(['A', 'B', 'C'] as const).map(group => {
            const items = grouped[group];
            const groupRevenue = items.reduce((s, p) => s + p.totalRevenue, 0);
            const groupProfit = items.reduce((s, p) => s + p.netProfit, 0);
            const colors = ABC_COLORS[group];
            const label = group === 'A' ? 'Yulduzlar (80%)' : group === 'B' ? "O'rtacha (15%)" : 'Sust (5%)';
            return (
              <Card key={group} className={`cursor-pointer transition-all flex-1 min-w-[180px] ${colors.bg} ${colors.border} border-2 ${selectedGroup === group ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedGroup(selectedGroup === group ? 'all' : group)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2"><Badge className={`${colors.badge} text-white text-sm px-2 py-0.5`}>{group}</Badge><span className="text-xs text-muted-foreground">{items.length} ta</span></div>
                  <div className={`text-xs font-medium ${colors.text} mb-2`}>{label}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Daromad:</span><span className="font-medium whitespace-nowrap">{formatPrice(groupRevenue)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Foyda:</span><span className={`font-medium whitespace-nowrap ${groupProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPrice(groupProfit)}</span></div>
                  </div>
                  <Progress value={totalRevenue > 0 ? (groupRevenue / totalRevenue) * 100 : 0} className="h-1 mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Products List */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Calculator className="h-4 w-4 shrink-0" />
                <span className="truncate">PnL</span>
                {selectedGroup !== 'all' && <Badge className={`${ABC_COLORS[selectedGroup].badge} text-white`}>{selectedGroup}</Badge>}
              </CardTitle>
              <CardDescription className="text-xs">{filteredProducts.length} ta mahsulot</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${store.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Mahsulotlar topilmadi</p></div>
          ) : isMobile ? (
            /* Mobile card layout */
            <div className="space-y-2 px-3 pb-3 max-h-[500px] overflow-y-auto">
              {filteredProducts.slice(0, 50).map(product => {
                const colors = ABC_COLORS[product.abcGroup];
                return (
                  <div key={`${product.id}-${product.marketplace}`} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium line-clamp-1">{product.name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge className={`${colors.badge} text-white text-[10px] px-1.5`}>{product.abcGroup}</Badge>
                          <Badge variant="outline" className="text-[10px]">{MARKETPLACE_NAMES[product.marketplace]}</Badge>
                          <code className="text-[10px] text-muted-foreground truncate">{product.sku}</code>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Sotildi:</span><div className="font-medium">{product.totalSold} ta</div></div>
                      <div><span className="text-muted-foreground">Daromad:</span><div className="font-medium whitespace-nowrap">{formatPrice(product.totalRevenue)}</div></div>
                      <div>
                        <span className="text-muted-foreground">Foyda:</span>
                        <div className={`font-bold whitespace-nowrap ${product.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {product.netProfit >= 0 ? '+' : ''}{formatPrice(product.netProfit)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Marja:</span>
                      <span className={`font-medium ${product.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{product.profitMargin.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length > 50 && <div className="text-xs text-muted-foreground text-center py-2">50 / {filteredProducts.length} ko'rsatilmoqda</div>}
            </div>
          ) : (
            /* Desktop table layout */
            <ScrollArea className="w-full">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10">ABC</TableHead><TableHead className="min-w-[180px]">Mahsulot</TableHead>
                  <TableHead className="w-16 text-center">MP</TableHead><TableHead className="w-20 text-right">Narxi</TableHead>
                  <TableHead className="w-16 text-center">Sotildi</TableHead><TableHead className="w-24 text-right">Daromad</TableHead>
                  <TableHead className="w-24 text-right">Tannarx</TableHead><TableHead className="w-20 text-right">Komissiya</TableHead>
                  <TableHead className="w-24 text-right">Sof foyda</TableHead><TableHead className="w-16 text-right">Marja</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredProducts.slice(0, 100).map(product => {
                    const colors = ABC_COLORS[product.abcGroup];
                    return (
                      <TableRow key={`${product.id}-${product.marketplace}`}>
                        <TableCell><Badge className={`${colors.badge} text-white`}>{product.abcGroup}</Badge></TableCell>
                        <TableCell><div className="font-medium text-sm line-clamp-1">{product.name}</div><code className="text-xs text-muted-foreground">{product.sku}</code></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-xs">{MARKETPLACE_NAMES[product.marketplace]}</Badge></TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">{formatPrice(product.price)}</TableCell>
                        <TableCell className="text-center font-medium">{product.totalSold}</TableCell>
                        <TableCell className="text-right text-sm font-medium whitespace-nowrap">{formatPrice(product.totalRevenue)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">{formatPrice(product.estimatedCost)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">{formatPrice(product.commissionAmount)}</TableCell>
                        <TableCell className="text-right"><span className={`font-bold text-sm whitespace-nowrap ${product.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{product.netProfit >= 0 ? '+' : ''}{formatPrice(product.netProfit)}</span></TableCell>
                        <TableCell className="text-right"><span className={`text-sm font-medium ${product.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{product.profitMargin.toFixed(0)}%</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
              {filteredProducts.length > 100 && <div className="mt-4 text-sm text-muted-foreground text-center">100 / {filteredProducts.length}</div>}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
