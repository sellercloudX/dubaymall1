import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  Package, RefreshCw, ArrowUpRight, ArrowDownRight,
  Percent, AlertTriangle, Star, Calculator
} from 'lucide-react';

interface ABCAnalysisProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
  commissionPercent?: number;
}

interface ProductPnL {
  id: string;
  name: string;
  sku: string;
  marketplace: string;
  price: number;
  totalSold: number;
  totalRevenue: number;
  estimatedCost: number;
  commissionAmount: number;
  logisticsCost: number;
  netProfit: number;
  profitMargin: number;
  abcGroup: 'A' | 'B' | 'C';
  revenueShare: number;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex',
  uzum: 'Uzum',
  wildberries: 'WB',
  ozon: 'Ozon',
};

const ABC_COLORS = {
  A: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30', badge: 'bg-green-500' },
  B: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30', badge: 'bg-amber-500' },
  C: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30', badge: 'bg-red-500' },
};

export function ABCAnalysis({
  connectedMarketplaces,
  fetchMarketplaceData,
  commissionPercent = 4
}: ABCAnalysisProps) {
  const [products, setProducts] = useState<ProductPnL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<'all' | 'A' | 'B' | 'C'>('all');

  useEffect(() => {
    if (connectedMarketplaces.length > 0) {
      loadAnalysis();
    } else {
      setIsLoading(false);
    }
  }, [connectedMarketplaces]);

  const loadAnalysis = async () => {
    setIsLoading(true);
    try {
      const allProducts: ProductPnL[] = [];

      for (const marketplace of connectedMarketplaces) {
        const [productsResult, ordersResult] = await Promise.all([
          fetchMarketplaceData(marketplace, 'products', { limit: 200, fetchAll: true }),
          fetchMarketplaceData(marketplace, 'orders', { fetchAll: true }),
        ]);

        const productsList = productsResult.data || [];
        const orders = ordersResult.data || [];

        // Build sales map from orders
        const salesMap = new Map<string, { qty: number; revenue: number }>();
        orders.forEach((order: any) => {
          const items = order.items || [];
          items.forEach((item: any) => {
            const key = item.offerId || item.shopSku || item.id;
            if (!key) return;
            const existing = salesMap.get(key) || { qty: 0, revenue: 0 };
            existing.qty += item.count || item.quantity || 1;
            existing.revenue += item.priceUZS || item.price || 0;
            salesMap.set(key, existing);
          });
        });

        // If no items in orders, distribute revenue evenly as estimate
        if (salesMap.size === 0 && orders.length > 0) {
          const totalOrderRevenue = orders.reduce((s: number, o: any) => s + (o.totalUZS || o.total || 0), 0);
          productsList.forEach((p: any) => {
            salesMap.set(p.offerId, {
              qty: Math.max(1, Math.floor(orders.length / Math.max(1, productsList.length))),
              revenue: Math.round(totalOrderRevenue / Math.max(1, productsList.length)),
            });
          });
        }

        productsList.forEach((product: any) => {
          const sales = salesMap.get(product.offerId) || { qty: 0, revenue: 0 };
          const price = product.price || 0;
          const totalRevenue = sales.revenue || sales.qty * price;
          const estimatedCost = totalRevenue * 0.6; // ~60% tannarx
          const commissionAmount = totalRevenue * (commissionPercent / 100);
          const logisticsCost = totalRevenue * 0.05; // ~5% logistika
          const netProfit = totalRevenue - estimatedCost - commissionAmount - logisticsCost;
          const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

          allProducts.push({
            id: product.offerId,
            name: product.name || 'Nomsiz',
            sku: product.shopSku || product.offerId,
            marketplace,
            price,
            totalSold: sales.qty,
            totalRevenue,
            estimatedCost,
            commissionAmount,
            logisticsCost,
            netProfit,
            profitMargin,
            abcGroup: 'C', // will be recalculated
            revenueShare: 0,
          });
        });
      }

      // Sort by revenue descending
      allProducts.sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate ABC groups
      const totalRevenue = allProducts.reduce((s, p) => s + p.totalRevenue, 0);
      let cumulativeShare = 0;

      allProducts.forEach((product) => {
        product.revenueShare = totalRevenue > 0 ? (product.totalRevenue / totalRevenue) * 100 : 0;
        cumulativeShare += product.revenueShare;

        if (cumulativeShare <= 80) {
          product.abcGroup = 'A';
        } else if (cumulativeShare <= 95) {
          product.abcGroup = 'B';
        } else {
          product.abcGroup = 'C';
        }
      });

      setProducts(allProducts);
    } catch (err) {
      console.error('ABC Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (Math.abs(price) >= 1000000) {
      return (price / 1000000).toFixed(1) + ' mln';
    }
    if (Math.abs(price) >= 1000) {
      return (price / 1000).toFixed(0) + ' ming';
    }
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const grouped = useMemo(() => {
    const a = products.filter(p => p.abcGroup === 'A');
    const b = products.filter(p => p.abcGroup === 'B');
    const c = products.filter(p => p.abcGroup === 'C');
    return { A: a, B: b, C: c };
  }, [products]);

  const filteredProducts = selectedGroup === 'all' ? products : grouped[selectedGroup];

  const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
  const totalProfit = products.reduce((s, p) => s + p.netProfit, 0);
  const profitableCount = products.filter(p => p.netProfit > 0).length;
  const unprofitableCount = products.filter(p => p.netProfit <= 0).length;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">ABC-analiz & PnL</h3>
          <p className="text-muted-foreground">Avval marketplace ulang</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-sm font-medium">Foydali</span>
            </div>
            <div className="text-2xl font-bold">{profitableCount}</div>
            <div className="text-xs text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <ArrowDownRight className="h-4 w-4" />
              <span className="text-sm font-medium">Zarardagi</span>
            </div>
            <div className="text-2xl font-bold">{unprofitableCount}</div>
            <div className="text-xs text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Jami daromad</span>
            </div>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
        <Card className={totalProfit >= 0
          ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
          : 'bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20'
        }>
          <CardContent className="pt-4">
            <div className={`flex items-center gap-2 mb-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {totalProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-sm font-medium">Sof foyda</span>
            </div>
            <div className="text-2xl font-bold">{formatPrice(totalProfit)}</div>
            <div className="text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
      </div>

      {/* ABC Group Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as const).map((group) => {
          const items = grouped[group];
          const groupRevenue = items.reduce((s, p) => s + p.totalRevenue, 0);
          const groupProfit = items.reduce((s, p) => s + p.netProfit, 0);
          const colors = ABC_COLORS[group];
          const label = group === 'A' ? 'Yulduzlar (80% daromad)' : group === 'B' ? "O'rtacha (15% daromad)" : 'Sust (5% daromad)';

          return (
            <Card
              key={group}
              className={`cursor-pointer transition-all ${colors.bg} ${colors.border} border-2 ${selectedGroup === group ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedGroup(selectedGroup === group ? 'all' : group)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`${colors.badge} text-white text-lg px-3 py-1`}>
                    {group}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{items.length} ta</span>
                </div>
                <div className={`text-sm font-medium ${colors.text} mb-2`}>{label}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daromad:</span>
                    <span className="font-medium">{formatPrice(groupRevenue)} so'm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Foyda:</span>
                    <span className={`font-medium ${groupProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPrice(groupProfit)} so'm
                    </span>
                  </div>
                </div>
                <Progress
                  value={totalRevenue > 0 ? (groupRevenue / totalRevenue) * 100 : 0}
                  className="h-1.5 mt-3"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* PnL Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Mahsulot bo'yicha PnL
                {selectedGroup !== 'all' && (
                  <Badge className={`${ABC_COLORS[selectedGroup].badge} text-white ml-2`}>
                    {selectedGroup} guruh
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Har bir mahsulot uchun foyda/zarar hisobi ({filteredProducts.length} ta)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadAnalysis} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Mahsulotlar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">ABC</TableHead>
                    <TableHead className="min-w-[180px]">Mahsulot</TableHead>
                    <TableHead className="w-16 text-center">MP</TableHead>
                    <TableHead className="w-20 text-right">Narxi</TableHead>
                    <TableHead className="w-16 text-center">Sotildi</TableHead>
                    <TableHead className="w-24 text-right">Daromad</TableHead>
                    <TableHead className="w-24 text-right">Tannarx</TableHead>
                    <TableHead className="w-20 text-right">Komissiya</TableHead>
                    <TableHead className="w-24 text-right">Sof foyda</TableHead>
                    <TableHead className="w-16 text-right">Marja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.slice(0, 100).map((product) => {
                    const colors = ABC_COLORS[product.abcGroup];
                    return (
                      <TableRow key={`${product.id}-${product.marketplace}`}>
                        <TableCell>
                          <Badge className={`${colors.badge} text-white`}>{product.abcGroup}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm line-clamp-1">{product.name}</div>
                          <code className="text-xs text-muted-foreground">{product.sku}</code>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {MARKETPLACE_NAMES[product.marketplace]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatPrice(product.price)}</TableCell>
                        <TableCell className="text-center font-medium">{product.totalSold}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatPrice(product.totalRevenue)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatPrice(product.estimatedCost)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatPrice(product.commissionAmount)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold text-sm ${product.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {product.netProfit >= 0 ? '+' : ''}{formatPrice(product.netProfit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-medium ${product.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {product.profitMargin.toFixed(0)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredProducts.length > 100 && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  Ko'rsatilmoqda: 100 / {filteredProducts.length}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
