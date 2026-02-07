import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Shield, ShieldAlert, ShieldCheck, DollarSign,
  AlertTriangle, Percent, Calculator, RefreshCw,
  Lock, Unlock, TrendingDown, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface MinPriceProtectionProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
  commissionPercent?: number;
}

interface ProtectedProduct {
  id: string; name: string; sku: string; marketplace: string;
  currentPrice: number; costPrice: number; commissionAmount: number;
  logisticsCost: number; minPrice: number; customMinPrice: number | null;
  isProtected: boolean; isBelowMin: boolean; priceGap: number;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex', uzum: 'Uzum', wildberries: 'WB', ozon: 'Ozon',
};

export function MinPriceProtection({
  connectedMarketplaces, store, commissionPercent = 4
}: MinPriceProtectionProps) {
  const [globalProtection, setGlobalProtection] = useState(true);
  const [defaultMargin, setDefaultMargin] = useState(10);
  const [logisticsPercent, setLogisticsPercent] = useState(5);
  const [costPercent, setCostPercent] = useState(60);
  const isLoading = store.isLoadingProducts;

  const products = useMemo(() => {
    const allProducts: ProtectedProduct[] = [];
    for (const marketplace of connectedMarketplaces) {
      store.getProducts(marketplace).forEach(product => {
        const currentPrice = product.price || 0;
        const costPrice = currentPrice * (costPercent / 100);
        const commissionAmount = currentPrice * (commissionPercent / 100);
        const logisticsCost = currentPrice * (logisticsPercent / 100);
        const totalCosts = costPrice + commissionAmount + logisticsCost;
        const minPrice = Math.ceil(totalCosts / (1 - defaultMargin / 100));
        const isBelowMin = currentPrice < minPrice && currentPrice > 0;

        allProducts.push({
          id: product.offerId, name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId, marketplace, currentPrice,
          costPrice, commissionAmount, logisticsCost, minPrice,
          customMinPrice: null, isProtected: globalProtection, isBelowMin,
          priceGap: currentPrice - minPrice,
        });
      });
    }
    allProducts.sort((a, b) => {
      if (a.isBelowMin && !b.isBelowMin) return -1;
      if (!a.isBelowMin && b.isBelowMin) return 1;
      return a.priceGap - b.priceGap;
    });
    return allProducts;
  }, [connectedMarketplaces, store.allProducts.length, costPercent, commissionPercent, logisticsPercent, defaultMargin, globalProtection]);

  const formatPrice = (price: number) => {
    if (Math.abs(price) >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    if (Math.abs(price) >= 1000) return (price / 1000).toFixed(0) + ' ming';
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const belowMinCount = products.filter(p => p.isBelowMin).length;
  const protectedCount = products.filter(p => p.isProtected).length;

  if (connectedMarketplaces.length === 0) {
    return (<Card><CardContent className="py-12 text-center"><Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Minimal narx himoyasi</h3><p className="text-muted-foreground">Avval marketplace ulang</p></CardContent></Card>);
  }

  if (isLoading) {
    return (<div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Shield className="h-4 w-4" /><span className="text-sm">Jami</span></div>
          <div className="text-2xl font-bold">{products.length}</div><div className="text-xs text-muted-foreground">mahsulot</div>
        </CardContent></Card>
        <Card className={belowMinCount > 0 ? 'border-red-500/30' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-1"><ShieldAlert className="h-4 w-4" /><span className="text-sm">Min dan past</span></div>
            <div className="text-2xl font-bold text-red-600">{belowMinCount}</div><div className="text-xs text-muted-foreground">xavfli narx</div>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-600 mb-1"><ShieldCheck className="h-4 w-4" /><span className="text-sm">Himoyalangan</span></div>
          <div className="text-2xl font-bold text-green-600">{protectedCount}</div><div className="text-xs text-muted-foreground">mahsulot</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Percent className="h-4 w-4" /><span className="text-sm">Min marja</span></div>
          <div className="text-2xl font-bold">{defaultMargin}%</div><div className="text-xs text-muted-foreground">belgilangan</div>
        </CardContent></Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Himoya sozlamalari</CardTitle>
            <CardDescription>Tannarx va marja koeffitsientlarini sozlang</CardDescription></div>
            <Button variant="outline" size="sm" onClick={() => store.refetchProducts()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${store.isFetching ? 'animate-spin' : ''}`} />Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><div><div className="font-medium">Global himoya</div><div className="text-sm text-muted-foreground">Barcha mahsulotlarga qo'llash</div></div>
            <Switch checked={globalProtection} onCheckedChange={setGlobalProtection} /></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="text-sm mb-1">Tannarx %</div><div className="flex items-center gap-1"><Input type="number" value={costPercent} onChange={e => setCostPercent(Number(e.target.value))} className="w-20" min={10} max={95} /><span className="text-sm">%</span></div></div>
            <div><div className="text-sm mb-1">Komissiya %</div><div className="flex items-center gap-1"><Input type="number" value={commissionPercent} className="w-20" disabled /><span className="text-sm">%</span></div></div>
            <div><div className="text-sm mb-1">Logistika %</div><div className="flex items-center gap-1"><Input type="number" value={logisticsPercent} onChange={e => setLogisticsPercent(Number(e.target.value))} className="w-20" min={0} max={30} /><span className="text-sm">%</span></div></div>
            <div><div className="text-sm mb-1">Min marja %</div><div className="flex items-center gap-1"><Input type="number" value={defaultMargin} onChange={e => setDefaultMargin(Number(e.target.value))} className="w-20" min={1} max={50} /><span className="text-sm">%</span></div></div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader><CardTitle>Narx himoyasi holati</CardTitle><CardDescription>{products.length} ta mahsulot tekshirildi</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="min-w-[180px]">Mahsulot</TableHead>
                <TableHead className="w-16 text-center">MP</TableHead>
                <TableHead className="w-28 text-right">Joriy narx</TableHead>
                <TableHead className="w-28 text-right">Min narx</TableHead>
                <TableHead className="w-24 text-right">Farq</TableHead>
                <TableHead className="w-20 text-center">Holat</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {products.slice(0, 100).map(product => (
                  <TableRow key={`${product.id}-${product.marketplace}`} className={product.isBelowMin ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                    <TableCell><div className="font-medium text-sm line-clamp-1">{product.name}</div><code className="text-xs text-muted-foreground">{product.sku}</code></TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="text-xs">{MARKETPLACE_NAMES[product.marketplace]}</Badge></TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatPrice(product.currentPrice)} so'm</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatPrice(product.minPrice)} so'm</TableCell>
                    <TableCell className="text-right"><span className={`font-medium ${product.priceGap >= 0 ? 'text-green-600' : 'text-red-600'}`}>{product.priceGap >= 0 ? '+' : ''}{formatPrice(product.priceGap)}</span></TableCell>
                    <TableCell className="text-center">
                      {product.isBelowMin ? <Badge variant="destructive" className="whitespace-nowrap"><TrendingDown className="h-3 w-3 mr-1" />Xavfli</Badge>
                        : <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 whitespace-nowrap"><ShieldCheck className="h-3 w-3 mr-1" />OK</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {products.length > 100 && <div className="mt-4 text-sm text-muted-foreground text-center">Ko'rsatilmoqda: 100 / {products.length}</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
