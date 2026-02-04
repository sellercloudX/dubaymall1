import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, TrendingUp, BarChart3, 
  Percent, Calculator, Eye, RefreshCw, AlertCircle
} from 'lucide-react';

interface PriceManagerProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
};

interface ProductPrice {
  id: string;
  name: string;
  sku: string;
  prices: Record<string, number>;
  avgPrice: number;
}

export function PriceManager({ connectedMarketplaces, fetchMarketplaceData }: PriceManagerProps) {
  const [products, setProducts] = useState<ProductPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoPricing, setAutoPricing] = useState(false);
  const [minProfit, setMinProfit] = useState(15);

  useEffect(() => {
    if (connectedMarketplaces.length > 0) {
      loadPricesFromMarketplaces();
    } else {
      setIsLoading(false);
    }
  }, [connectedMarketplaces]);

  const loadPricesFromMarketplaces = async () => {
    setIsLoading(true);
    
    try {
      const productMap = new Map<string, ProductPrice>();

      for (const marketplace of connectedMarketplaces) {
        const result = await fetchMarketplaceData(marketplace, 'products', { limit: 100 });
        
        if (result.success && result.data) {
          result.data.forEach((product: any) => {
            const sku = product.shopSku || product.offerId;
            const price = product.price || 0;
            const existing = productMap.get(sku);
            
            if (existing) {
              existing.prices[marketplace] = price;
              // Recalculate average
              const prices = Object.values(existing.prices).filter(p => p > 0);
              existing.avgPrice = prices.length > 0 
                ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
                : 0;
            } else {
              productMap.set(sku, {
                id: product.offerId,
                name: product.name || 'Nomsiz',
                sku: sku,
                prices: { [marketplace]: price },
                avgPrice: price,
              });
            }
          });
        }
      }

      setProducts(Array.from(productMap.values()));
    } catch (err) {
      console.error('Error loading prices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('uz-UZ', { 
      style: 'decimal',
      minimumFractionDigits: 0 
    }).format(price) + ' so\'m';
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Narx boshqaruvi</h3>
          <p className="text-muted-foreground mb-4">
            Avval kamida bitta marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalProducts = products.length;
  const avgOverallPrice = products.length > 0 
    ? Math.round(products.reduce((sum, p) => sum + p.avgPrice, 0) / products.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calculator className="h-4 w-4" />
              O'rtacha narx
            </div>
            <div className="text-2xl font-bold">{formatPrice(avgOverallPrice)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Minimal foyda %
            </div>
            <div className="text-2xl font-bold text-green-600">{minProfit}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Eye className="h-4 w-4" />
              Monitoring
            </div>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <div className="text-xs text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <AlertCircle className="h-4 w-4" />
              Marketplacelar
            </div>
            <div className="text-2xl font-bold text-primary">{connectedMarketplaces.length}</div>
            <div className="text-xs text-muted-foreground">ulangan</div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Narx sozlamalari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avtomatik narxlash</span>
                <Switch checked={autoPricing} onCheckedChange={setAutoPricing} />
              </div>
              <p className="text-xs text-muted-foreground">
                Raqobatchilar asosida avtomatik
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <label className="text-sm font-medium">Minimal foyda %</label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={minProfit} 
                  onChange={(e) => setMinProfit(Number(e.target.value))}
                  className="h-8"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="text-sm font-medium">Narx yuvarlash</div>
              <Badge variant="outline">99 ga tugasin</Badge>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="text-sm font-medium">Yangilash chastotasi</div>
              <Badge variant="outline">Har 1 soatda</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Mahsulotlar narxi
                {products.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{products.length} ta</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Marketplacedagi haqiqiy narxlar
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadPricesFromMarketplaces}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Mahsulotlar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">Mahsulot</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">SKU</th>
                    {connectedMarketplaces.map(mp => (
                      <th key={mp} className="text-right py-3 px-2 text-sm font-medium">
                        {MARKETPLACE_NAMES[mp]}
                      </th>
                    ))}
                    <th className="text-right py-3 px-2 text-sm font-medium">O'rtacha</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="font-medium text-sm line-clamp-1">{product.name}</div>
                      </td>
                      <td className="py-3 px-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.sku}</code>
                      </td>
                      {connectedMarketplaces.map(mp => (
                        <td key={mp} className="text-right py-3 px-2">
                          <span className="font-medium">
                            {formatPrice(product.prices[mp])}
                          </span>
                        </td>
                      ))}
                      <td className="text-right py-3 px-2">
                        <Badge variant="outline" className="bg-primary/10">
                          {formatPrice(product.avgPrice)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ommaviy amallar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">
              <Percent className="h-4 w-4 mr-2" />
              Barcha narxlarni +5%
            </Button>
            <Button variant="outline">
              <Calculator className="h-4 w-4 mr-2" />
              Foydani qayta hisoblash
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
