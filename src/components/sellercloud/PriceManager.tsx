import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, BarChart3, Percent, Calculator, Eye, RefreshCw } from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface PriceManagerProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex', uzum: 'Uzum', wildberries: 'WB', ozon: 'Ozon',
};

interface ProductPrice {
  id: string;
  name: string;
  sku: string;
  price: number;
  marketplace: string;
}

export function PriceManager({ connectedMarketplaces, store }: PriceManagerProps) {
  const [autoPricing, setAutoPricing] = useState(false);
  const [minProfit, setMinProfit] = useState(15);
  const isLoading = store.isLoadingProducts;

  const products = useMemo(() => {
    const allProducts: ProductPrice[] = [];
    for (const marketplace of connectedMarketplaces) {
      store.getProducts(marketplace).forEach(product => {
        allProducts.push({
          id: product.offerId,
          name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId,
          price: product.price || 0,
          marketplace,
        });
      });
    }
    return allProducts;
  }, [connectedMarketplaces, store.dataVersion]);

  const formatPrice = (price?: number) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + p.price, 0) / products.length : 0;
  const maxPrice = products.length > 0 ? Math.max(...products.map(p => p.price)) : 0;
  const minPrice = products.length > 0 ? Math.min(...products.filter(p => p.price > 0).map(p => p.price)) : 0;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Narxlar boshqaruvi</h3>
        <p className="text-muted-foreground mb-4">Avval marketplace ulang</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Price Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">Jami mahsulotlar</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{products.length}</div>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">O'rtacha narx</div>
          {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatPrice(Math.round(avgPrice))}</div>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">Min narx</div>
          {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatPrice(minPrice)}</div>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">Max narx</div>
          {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatPrice(maxPrice)}</div>}
        </CardContent></Card>
      </div>

      {/* Auto Pricing */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Avtomatik narxlash</CardTitle>
            <CardDescription>Raqobatchilar narxiga qarab avtomatik moslashtirish</CardDescription></div>
            <Button variant="outline" size="sm" onClick={() => store.refetchProducts()} disabled={store.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${store.isFetching ? 'animate-spin' : ''}`} />Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><div className="font-medium">Avtomatik narxlash</div>
            <div className="text-sm text-muted-foreground">Raqobatchilar narxiga qarab</div></div>
            <Switch checked={autoPricing} onCheckedChange={setAutoPricing} />
          </div>
          {autoPricing && (
            <div className="flex items-center gap-4">
              <div className="flex-1"><div className="text-sm mb-1">Minimal foyda foizi</div>
              <div className="flex items-center gap-2">
                <Input type="number" value={minProfit} onChange={(e) => setMinProfit(Number(e.target.value))} className="w-20" min={0} max={100} />
                <span className="text-sm text-muted-foreground">%</span>
              </div></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Price List */}
      <Card>
        <CardHeader><CardTitle>Mahsulotlar narxlari</CardTitle><CardDescription>{products.length} ta mahsulot</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {products.map(product => (
                <div key={`${product.id}-${product.marketplace}`} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{product.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{MARKETPLACE_NAMES[product.marketplace]}</Badge>
                      <span>{product.sku}</span>
                    </div>
                  </div>
                  <div className="font-bold whitespace-nowrap ml-4">{formatPrice(product.price)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
