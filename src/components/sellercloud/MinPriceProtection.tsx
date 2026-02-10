import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Shield, ShieldAlert, ShieldCheck,
  Percent, RefreshCw, TrendingDown, Settings
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const [logisticsPerOrder, setLogisticsPerOrder] = useState(4000);
  const isMobile = useIsMobile();
  const isLoading = store.isLoadingProducts;

  const products = useMemo(() => {
    const allProducts: ProtectedProduct[] = [];
    for (const marketplace of connectedMarketplaces) {
      store.getProducts(marketplace).forEach(product => {
        const currentPrice = product.price || 0;
        const costPrice = 0; // Will use real cost prices when available
        const yandexCommission = currentPrice * 0.20; // 20% marketplace
        const platformCommission = currentPrice * (commissionPercent / 100);
        const taxAmount = currentPrice * 0.04; // 4% tax
        const totalCosts = costPrice + yandexCommission + platformCommission + taxAmount + logisticsPerOrder;
        const minPrice = Math.ceil(totalCosts / (1 - defaultMargin / 100));
        const isBelowMin = currentPrice < minPrice && currentPrice > 0;

        allProducts.push({
          id: product.offerId, name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId, marketplace, currentPrice,
          costPrice, commissionAmount: yandexCommission + platformCommission + taxAmount,
          logisticsCost: logisticsPerOrder, minPrice,
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
  }, [connectedMarketplaces, store.dataVersion, commissionPercent, logisticsPerOrder, defaultMargin, globalProtection]);

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
    return (<div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>);
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="overflow-hidden"><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Shield className="h-3.5 w-3.5 shrink-0" /><span className="text-xs truncate">Jami</span></div>
          <div className="text-xl font-bold">{products.length}</div><div className="text-[10px] text-muted-foreground">mahsulot</div>
        </CardContent></Card>
        <Card className={`overflow-hidden ${belowMinCount > 0 ? 'border-red-500/30' : ''}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-red-600 mb-1"><ShieldAlert className="h-3.5 w-3.5 shrink-0" /><span className="text-xs truncate">Min dan past</span></div>
            <div className="text-xl font-bold text-red-600">{belowMinCount}</div><div className="text-[10px] text-muted-foreground">xavfli</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden"><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-green-600 mb-1"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /><span className="text-xs truncate">Himoyalangan</span></div>
          <div className="text-xl font-bold text-green-600">{protectedCount}</div><div className="text-[10px] text-muted-foreground">mahsulot</div>
        </CardContent></Card>
        <Card className="overflow-hidden"><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Percent className="h-3.5 w-3.5 shrink-0" /><span className="text-xs truncate">Min marja</span></div>
          <div className="text-xl font-bold">{defaultMargin}%</div><div className="text-[10px] text-muted-foreground">belgilangan</div>
        </CardContent></Card>
      </div>

      {/* Settings */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Settings className="h-4 w-4 shrink-0" /><span className="truncate">Sozlamalar</span></CardTitle>
              <CardDescription className="text-xs truncate">Tannarx va marja koeffitsientlari</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchProducts()} disabled={store.isFetching} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${store.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0"><div className="font-medium text-sm">Global himoya</div><div className="text-xs text-muted-foreground truncate">Barcha mahsulotlarga</div></div>
            <Switch checked={globalProtection} onCheckedChange={setGlobalProtection} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs mb-1">Logistika (so'm)</div><div className="flex items-center gap-1"><Input type="number" value={logisticsPerOrder} onChange={e => setLogisticsPerOrder(Number(e.target.value))} className="w-full h-8 text-sm" min={0} max={50000} /><span className="text-xs shrink-0">so'm</span></div></div>
            <div><div className="text-xs mb-1">Komissiya %</div><div className="flex items-center gap-1"><Input type="number" value={commissionPercent} className="w-full h-8 text-sm" disabled /><span className="text-xs shrink-0">%</span></div></div>
            <div><div className="text-xs mb-1">Min marja %</div><div className="flex items-center gap-1"><Input type="number" value={defaultMargin} onChange={e => setDefaultMargin(Number(e.target.value))} className="w-full h-8 text-sm" min={1} max={50} /><span className="text-xs shrink-0">%</span></div></div>
            <div><div className="text-xs mb-1 text-muted-foreground">Tannarx</div><div className="text-xs text-muted-foreground">Mahsulotlar tabidan kiritiladi</div></div>
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">Narx himoyasi</CardTitle><CardDescription className="text-xs">{products.length} ta tekshirildi</CardDescription></CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isMobile ? (
            <div className="space-y-2 px-3 pb-3 max-h-[500px] overflow-y-auto">
              {products.slice(0, 50).map(product => (
                <div key={`${product.id}-${product.marketplace}`} className={`p-3 rounded-lg border space-y-1.5 ${product.isBelowMin ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium line-clamp-1">{product.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px]">{MARKETPLACE_NAMES[product.marketplace]}</Badge>
                        <code className="text-[10px] text-muted-foreground truncate">{product.sku}</code>
                      </div>
                    </div>
                    {product.isBelowMin ? (
                      <Badge variant="destructive" className="text-[10px] shrink-0"><TrendingDown className="h-3 w-3 mr-0.5" />Xavfli</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px] shrink-0"><ShieldCheck className="h-3 w-3 mr-0.5" />OK</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Joriy:</span><div className="font-medium whitespace-nowrap">{formatPrice(product.currentPrice)}</div></div>
                    <div><span className="text-muted-foreground">Min:</span><div className="font-medium whitespace-nowrap">{formatPrice(product.minPrice)}</div></div>
                    <div><span className="text-muted-foreground">Farq:</span>
                      <div className={`font-bold whitespace-nowrap ${product.priceGap >= 0 ? 'text-green-600' : 'text-red-600'}`}>{product.priceGap >= 0 ? '+' : ''}{formatPrice(product.priceGap)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {products.length > 50 && <div className="text-xs text-muted-foreground text-center py-2">50 / {products.length} ko'rsatilmoqda</div>}
            </div>
          ) : (
            <ScrollArea className="w-full">
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
                      <TableCell className="text-right"><span className={`font-medium whitespace-nowrap ${product.priceGap >= 0 ? 'text-green-600' : 'text-red-600'}`}>{product.priceGap >= 0 ? '+' : ''}{formatPrice(product.priceGap)}</span></TableCell>
                      <TableCell className="text-center">
                        {product.isBelowMin ? <Badge variant="destructive" className="whitespace-nowrap"><TrendingDown className="h-3 w-3 mr-1" />Xavfli</Badge>
                          : <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 whitespace-nowrap"><ShieldCheck className="h-3 w-3 mr-1" />OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
              {products.length > 100 && <div className="mt-4 text-sm text-muted-foreground text-center">100 / {products.length}</div>}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
