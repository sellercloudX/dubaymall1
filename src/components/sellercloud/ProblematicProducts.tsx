import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import {
  AlertTriangle, TrendingDown, RotateCcw, Star,
  Package, RefreshCw, Eye, ShoppingCart, XCircle,
  AlertOctagon, Clock, BarChart3
} from 'lucide-react';

interface ProblematicProductsProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

interface ProblemProduct {
  id: string;
  name: string;
  sku: string;
  marketplace: string;
  price: number;
  stock: number;
  problemType: 'low_sales' | 'high_returns' | 'low_stock' | 'no_sales' | 'overstock' | 'inactive';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  metric: string;
  suggestion: string;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex',
  uzum: 'Uzum',
  wildberries: 'WB',
  ozon: 'Ozon',
};

const PROBLEM_TYPES = {
  no_sales: { label: 'Sotilmagan', icon: XCircle, color: 'text-red-600' },
  low_sales: { label: 'Kam sotilgan', icon: TrendingDown, color: 'text-orange-600' },
  low_stock: { label: 'Kam qoldiq', icon: AlertTriangle, color: 'text-amber-600' },
  overstock: { label: "Ortiqcha zaxira", icon: Package, color: 'text-blue-600' },
  high_returns: { label: "Ko'p qaytarilgan", icon: RotateCcw, color: 'text-purple-600' },
  inactive: { label: 'Nofaol', icon: Clock, color: 'text-gray-600' },
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export function ProblematicProducts({
  connectedMarketplaces,
  fetchMarketplaceData,
}: ProblematicProductsProps) {
  const [problems, setProblems] = useState<ProblemProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (connectedMarketplaces.length > 0) {
      analyzeProducts();
    } else {
      setIsLoading(false);
    }
  }, [connectedMarketplaces]);

  const analyzeProducts = async () => {
    setIsLoading(true);
    try {
      const allProblems: ProblemProduct[] = [];

      for (const marketplace of connectedMarketplaces) {
        const [productsResult, ordersResult] = await Promise.all([
          fetchMarketplaceData(marketplace, 'products', { limit: 200, fetchAll: true }),
          fetchMarketplaceData(marketplace, 'orders', { fetchAll: true }),
        ]);

        const productsList = productsResult.data || [];
        const orders = ordersResult.data || [];

        // Build sales count per product
        const salesCount = new Map<string, number>();
        orders.forEach((order: any) => {
          const items = order.items || [];
          items.forEach((item: any) => {
            const key = item.offerId || item.shopSku || item.id;
            if (!key) return;
            salesCount.set(key, (salesCount.get(key) || 0) + (item.count || item.quantity || 1));
          });
        });

        // If no items info, distribute evenly
        const avgSalesPerProduct = orders.length > 0 && productsList.length > 0
          ? orders.length / productsList.length
          : 0;

        productsList.forEach((product: any) => {
          const stock = (product.stockFBO || 0) + (product.stockFBS || 0) + (product.stockCount || 0);
          const sold = salesCount.get(product.offerId) || 0;
          const price = product.price || 0;
          const availability = product.availability?.toUpperCase();
          const isInactive = ['INACTIVE', 'UNPUBLISHED', 'DISABLED_BY_PARTNER', 'DISABLED_AUTOMATICALLY', 'ARCHIVED'].includes(availability || '');

          // No sales at all
          if (sold === 0 && !isInactive && price > 0) {
            allProblems.push({
              id: product.offerId,
              name: product.name || 'Nomsiz',
              sku: product.shopSku || product.offerId,
              marketplace,
              price,
              stock,
              problemType: 'no_sales',
              severity: 'critical',
              description: 'Bu mahsulot hech qachon sotilmagan',
              metric: '0 ta sotilgan',
              suggestion: 'Narxni tushiring, rasmlarni yaxshilang yoki reklamaga qo\'shing',
            });
          }
          // Low sales (sold < average)
          else if (sold > 0 && sold < avgSalesPerProduct * 0.3 && avgSalesPerProduct > 1) {
            allProblems.push({
              id: product.offerId,
              name: product.name || 'Nomsiz',
              sku: product.shopSku || product.offerId,
              marketplace,
              price,
              stock,
              problemType: 'low_sales',
              severity: 'warning',
              description: 'O\'rtachadan ancha kam sotilgan',
              metric: `${sold} ta (o'rtacha: ${Math.round(avgSalesPerProduct)})`,
              suggestion: 'Promo-aksiyaga qo\'shing yoki tavsifni yaxshilang',
            });
          }

          // Low stock
          if (stock > 0 && stock <= 3 && !isInactive) {
            allProblems.push({
              id: product.offerId,
              name: product.name || 'Nomsiz',
              sku: product.shopSku || product.offerId,
              marketplace,
              price,
              stock,
              problemType: 'low_stock',
              severity: stock <= 1 ? 'critical' : 'warning',
              description: 'Zaxira tugamoqda',
              metric: `${stock} dona qoldi`,
              suggestion: 'Tezda to\'ldiring, aks holda sotuvdan chiqadi',
            });
          }

          // Overstock (high stock but no/low sales)
          if (stock > 50 && sold <= 2) {
            allProblems.push({
              id: product.offerId,
              name: product.name || 'Nomsiz',
              sku: product.shopSku || product.offerId,
              marketplace,
              price,
              stock,
              problemType: 'overstock',
              severity: 'info',
              description: 'Ko\'p zaxira bor, lekin kam sotilmoqda',
              metric: `${stock} dona zaxirada, ${sold} sotilgan`,
              suggestion: 'Chegirma qo\'ying yoki boshqa kanalda soting',
            });
          }

          // Inactive products
          if (isInactive) {
            allProblems.push({
              id: product.offerId,
              name: product.name || 'Nomsiz',
              sku: product.shopSku || product.offerId,
              marketplace,
              price,
              stock,
              problemType: 'inactive',
              severity: 'info',
              description: 'Marketplace\'da nofaol holatda',
              metric: availability || 'Nofaol',
              suggestion: 'Faollashtiring yoki arxivga ko\'shing',
            });
          }
        });
      }

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      allProblems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      setProblems(allProblems);
    } catch (err) {
      console.error('Problem analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ProblemProduct[]> = {
      all: problems,
      no_sales: problems.filter(p => p.problemType === 'no_sales'),
      low_sales: problems.filter(p => p.problemType === 'low_sales'),
      low_stock: problems.filter(p => p.problemType === 'low_stock'),
      overstock: problems.filter(p => p.problemType === 'overstock'),
      inactive: problems.filter(p => p.problemType === 'inactive'),
    };
    return groups;
  }, [problems]);

  const criticalCount = problems.filter(p => p.severity === 'critical').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertOctagon className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Muammoli mahsulotlar</h3>
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
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={criticalCount > 0 ? 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertOctagon className="h-4 w-4" />
              <span className="text-sm font-medium">Jiddiy</span>
            </div>
            <div className="text-2xl font-bold">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">zudlik bilan hal qiling</div>
          </CardContent>
        </Card>
        <Card className={warningCount > 0 ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Ogohlantirish</span>
            </div>
            <div className="text-2xl font-bold">{warningCount}</div>
            <div className="text-xs text-muted-foreground">e'tibor bering</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Sotilmagan</span>
            </div>
            <div className="text-2xl font-bold">{grouped.no_sales.length}</div>
            <div className="text-xs text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm font-medium">Jami muammo</span>
            </div>
            <div className="text-2xl font-bold text-primary">{problems.length}</div>
            <div className="text-xs text-muted-foreground">aniqlandi</div>
          </CardContent>
        </Card>
      </div>

      {problems.length === 0 ? (
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="py-12 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold text-green-600 mb-2">Muammo topilmadi!</h3>
            <p className="text-muted-foreground">
              Barcha mahsulotlaringiz normal holatda
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Problem Type Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="all" className="gap-1">
                  Hammasi
                  <Badge variant="secondary" className="ml-1 text-xs">{problems.length}</Badge>
                </TabsTrigger>
                {Object.entries(PROBLEM_TYPES).map(([key, { label, icon: Icon }]) => {
                  const count = grouped[key]?.length || 0;
                  if (count === 0) return null;
                  return (
                    <TabsTrigger key={key} value={key} className="gap-1">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{label}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <Button variant="outline" size="sm" onClick={analyzeProducts} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Qayta tahlil
              </Button>
            </div>

            {/* Table */}
            {Object.keys(grouped).map((tabKey) => (
              <TabsContent key={tabKey} value={tabKey}>
                <Card>
                  <CardContent className="pt-6">
                    {(grouped[tabKey]?.length || 0) === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Bu kategoriyada muammo topilmadi</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">⚠️</TableHead>
                              <TableHead className="min-w-[180px]">Mahsulot</TableHead>
                              <TableHead className="w-16 text-center">MP</TableHead>
                              <TableHead className="w-24 text-center">Muammo</TableHead>
                              <TableHead className="w-28 text-right">Narxi</TableHead>
                              <TableHead className="w-16 text-center">Zaxira</TableHead>
                              <TableHead className="w-32">Ko'rsatkich</TableHead>
                              <TableHead className="min-w-[200px]">Tavsiya</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(grouped[tabKey] || []).slice(0, 100).map((problem, idx) => {
                              const problemInfo = PROBLEM_TYPES[problem.problemType];
                              const ProblemIcon = problemInfo.icon;
                              return (
                                <TableRow
                                  key={`${problem.id}-${problem.marketplace}-${problem.problemType}-${idx}`}
                                  className={problem.severity === 'critical' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                                >
                                  <TableCell>
                                    <Badge className={`${SEVERITY_BADGE[problem.severity]} text-white text-xs px-1.5`}>
                                      {problem.severity === 'critical' ? '!' : problem.severity === 'warning' ? '⚡' : 'ℹ'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium text-sm line-clamp-1">{problem.name}</div>
                                    <code className="text-xs text-muted-foreground">{problem.sku}</code>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="text-xs">
                                      {MARKETPLACE_NAMES[problem.marketplace]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className={`text-xs ${problemInfo.color}`}>
                                      <ProblemIcon className="h-3 w-3 mr-1" />
                                      {problemInfo.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-sm">
                                    {formatPrice(problem.price)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={problem.stock <= 3 ? 'destructive' : 'outline'} className="text-xs">
                                      {problem.stock}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-muted-foreground">{problem.metric}</span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-primary">{problem.suggestion}</span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
