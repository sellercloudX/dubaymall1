import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, TrendingDown, RotateCcw,
  Package, RefreshCw, ShoppingCart, XCircle,
  AlertOctagon, Clock, BarChart3
} from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface ProblematicProductsProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface ProblemProduct {
  id: string; name: string; sku: string; marketplace: string;
  price: number; stock: number;
  problemType: 'low_sales' | 'high_returns' | 'low_stock' | 'no_sales' | 'overstock' | 'inactive';
  severity: 'critical' | 'warning' | 'info';
  description: string; metric: string; suggestion: string;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex', uzum: 'Uzum', wildberries: 'WB', ozon: 'Ozon',
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
  critical: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500',
};

export function ProblematicProducts({ connectedMarketplaces, store }: ProblematicProductsProps) {
  const [activeTab, setActiveTab] = useState('all');
  const isLoading = store.isLoading;

  const problems = useMemo(() => {
    if (isLoading) return [];
    const allProblems: ProblemProduct[] = [];

    for (const marketplace of connectedMarketplaces) {
      const productsList = store.getProducts(marketplace);
      const orders = store.getOrders(marketplace);

      const salesCount = new Map<string, number>();
      orders.forEach(order => {
        (order.items || []).forEach(item => {
          const key = item.offerId;
          if (!key) return;
          salesCount.set(key, (salesCount.get(key) || 0) + (item.count || 1));
        });
      });

      const avgSalesPerProduct = orders.length > 0 && productsList.length > 0
        ? orders.length / productsList.length : 0;

      productsList.forEach(product => {
        const stock = (product.stockFBO || 0) + (product.stockFBS || 0) + (product.stockCount || 0);
        const sold = salesCount.get(product.offerId) || 0;
        const price = product.price || 0;
        const availability = product.availability?.toUpperCase();
        const isInactive = ['INACTIVE', 'UNPUBLISHED', 'DISABLED_BY_PARTNER', 'DISABLED_AUTOMATICALLY', 'ARCHIVED'].includes(availability || '');

        if (sold === 0 && !isInactive && price > 0) {
          allProblems.push({ id: product.offerId, name: product.name || 'Nomsiz', sku: product.shopSku || product.offerId,
            marketplace, price, stock, problemType: 'no_sales', severity: 'critical',
            description: 'Bu mahsulot hech qachon sotilmagan', metric: '0 ta sotilgan',
            suggestion: 'Narxni tushiring, rasmlarni yaxshilang yoki reklamaga qo\'shing' });
        } else if (sold > 0 && sold < avgSalesPerProduct * 0.3 && avgSalesPerProduct > 1) {
          allProblems.push({ id: product.offerId, name: product.name || 'Nomsiz', sku: product.shopSku || product.offerId,
            marketplace, price, stock, problemType: 'low_sales', severity: 'warning',
            description: 'O\'rtachadan ancha kam sotilgan', metric: `${sold} ta (o'rtacha: ${Math.round(avgSalesPerProduct)})`,
            suggestion: 'Promo-aksiyaga qo\'shing yoki tavsifni yaxshilang' });
        }

        if (stock > 0 && stock <= 3 && !isInactive) {
          allProblems.push({ id: product.offerId, name: product.name || 'Nomsiz', sku: product.shopSku || product.offerId,
            marketplace, price, stock, problemType: 'low_stock', severity: stock <= 1 ? 'critical' : 'warning',
            description: 'Zaxira tugamoqda', metric: `${stock} dona qoldi`,
            suggestion: 'Tezda to\'ldiring, aks holda sotuvdan chiqadi' });
        }

        if (stock > 50 && sold === 0) {
          allProblems.push({ id: product.offerId, name: product.name || 'Nomsiz', sku: product.shopSku || product.offerId,
            marketplace, price, stock, problemType: 'overstock', severity: 'info',
            description: 'Ortiqcha zaxira, sotilmayapti', metric: `${stock} dona`,
            suggestion: 'Chegirma qiling yoki boshqa kanalda soting' });
        }

        if (isInactive) {
          allProblems.push({ id: product.offerId, name: product.name || 'Nomsiz', sku: product.shopSku || product.offerId,
            marketplace, price, stock, problemType: 'inactive', severity: 'warning',
            description: 'Mahsulot nofaol holatda', metric: availability || 'INACTIVE',
            suggestion: 'Faollashtiring yoki o\'chirib tashlang' });
        }
      });
    }

    allProblems.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });

    return allProblems;
  }, [connectedMarketplaces, store.allProducts.length, store.allOrders.length, isLoading]);

  const byType = useMemo(() => {
    const map: Record<string, ProblemProduct[]> = {};
    Object.keys(PROBLEM_TYPES).forEach(t => { map[t] = []; });
    problems.forEach(p => { if (!map[p.problemType]) map[p.problemType] = []; map[p.problemType].push(p); });
    return map;
  }, [problems]);

  const criticalCount = problems.filter(p => p.severity === 'critical').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  const displayProblems = activeTab === 'all' ? problems : (byType[activeTab] || []);

  const formatPrice = (price: number) => new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';

  if (connectedMarketplaces.length === 0) {
    return (<Card><CardContent className="py-12 text-center"><AlertOctagon className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Muammoli mahsulotlar</h3><p className="text-muted-foreground">Avval marketplace ulang</p></CardContent></Card>);
  }

  if (isLoading) {
    return (<div className="space-y-4"><div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className={criticalCount > 0 ? 'border-red-500/30' : ''}><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-red-600 mb-1"><AlertOctagon className="h-4 w-4" /><span className="text-sm">Kritik</span></div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-amber-600 mb-1"><AlertTriangle className="h-4 w-4" /><span className="text-sm">Ogohlantirish</span></div>
          <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Package className="h-4 w-4" /><span className="text-sm">Jami</span></div>
          <div className="text-2xl font-bold">{problems.length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><AlertOctagon className="h-5 w-5" />Muammolar ro'yxati</CardTitle>
            <CardDescription>{problems.length} ta muammo topildi</CardDescription></div>
            <Button variant="outline" size="sm" onClick={() => store.refetchAll()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${store.isFetching ? 'animate-spin' : ''}`} />Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              <TabsTrigger value="all">Barchasi ({problems.length})</TabsTrigger>
              {Object.entries(PROBLEM_TYPES).map(([key, val]) => {
                const count = byType[key]?.length || 0;
                if (count === 0) return null;
                return <TabsTrigger key={key} value={key}>{val.label} ({count})</TabsTrigger>;
              })}
            </TabsList>
          </Tabs>

          {displayProblems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Muammolar topilmadi 🎉</p></div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {displayProblems.map((problem, idx) => {
                const typeInfo = PROBLEM_TYPES[problem.problemType];
                const Icon = typeInfo?.icon || AlertTriangle;
                return (
                  <div key={`${problem.id}-${problem.marketplace}-${problem.problemType}-${idx}`} className="p-4 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 ${typeInfo?.color || 'text-muted-foreground'}`}><Icon className="h-5 w-5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${SEVERITY_BADGE[problem.severity]} text-white text-xs`}>{problem.severity === 'critical' ? 'Kritik' : problem.severity === 'warning' ? 'Ogohlantirish' : 'Info'}</Badge>
                          <Badge variant="outline" className="text-xs">{MARKETPLACE_NAMES[problem.marketplace]}</Badge>
                        </div>
                        <div className="font-medium text-sm truncate">{problem.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{problem.description}</div>
                        <div className="text-xs font-medium mt-1">{problem.metric}</div>
                        <div className="text-xs text-blue-600 mt-2">💡 {problem.suggestion}</div>
                      </div>
                      <div className="text-right whitespace-nowrap"><div className="font-bold text-sm">{formatPrice(problem.price)}</div><div className="text-xs text-muted-foreground">{problem.stock} dona</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
