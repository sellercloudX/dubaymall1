import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import {
  Shield, ShieldAlert, ShieldCheck, DollarSign,
  AlertTriangle, Percent, Calculator, RefreshCw,
  Lock, Unlock, TrendingDown, Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface MinPriceProtectionProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
  commissionPercent?: number;
}

interface ProtectedProduct {
  id: string;
  name: string;
  sku: string;
  marketplace: string;
  currentPrice: number;
  costPrice: number;      // tannarx (estimated)
  commissionAmount: number;
  logisticsCost: number;
  minPrice: number;        // hisoblangan minimal narx
  customMinPrice: number | null;
  isProtected: boolean;
  isBelowMin: boolean;
  priceGap: number;        // joriy narx va min narx orasidagi farq
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex',
  uzum: 'Uzum',
  wildberries: 'WB',
  ozon: 'Ozon',
};

export function MinPriceProtection({
  connectedMarketplaces,
  fetchMarketplaceData,
  commissionPercent = 4
}: MinPriceProtectionProps) {
  const [products, setProducts] = useState<ProtectedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalProtection, setGlobalProtection] = useState(true);
  const [defaultMargin, setDefaultMargin] = useState(10); // min foyda foizi
  const [logisticsPercent, setLogisticsPercent] = useState(5);
  const [costPercent, setCostPercent] = useState(60); // tannarx foizi

  useEffect(() => {
    if (connectedMarketplaces.length > 0) {
      loadProducts();
    } else {
      setIsLoading(false);
    }
  }, [connectedMarketplaces, costPercent, commissionPercent, logisticsPercent, defaultMargin]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const allProducts: ProtectedProduct[] = [];

      for (const marketplace of connectedMarketplaces) {
        const result = await fetchMarketplaceData(marketplace, 'products', {
          limit: 200,
          fetchAll: true,
        });

        if (result.success && result.data) {
          result.data.forEach((product: any) => {
            const currentPrice = product.price || 0;
            const costPrice = currentPrice * (costPercent / 100);
            const commissionAmount = currentPrice * (commissionPercent / 100);
            const logisticsCost = currentPrice * (logisticsPercent / 100);
            const totalCosts = costPrice + commissionAmount + logisticsCost;
            const minPrice = Math.ceil(totalCosts / (1 - defaultMargin / 100));
            const isBelowMin = currentPrice < minPrice && currentPrice > 0;

            allProducts.push({
              id: product.offerId,
              name: product.name || 'Nomsiz',
              sku: product.shopSku || product.offerId,
              marketplace,
              currentPrice,
              costPrice,
              commissionAmount,
              logisticsCost,
              minPrice,
              customMinPrice: null,
              isProtected: globalProtection,
              isBelowMin,
              priceGap: currentPrice - minPrice,
            });
          });
        }
      }

      // Sort: below-min first, then by gap
      allProducts.sort((a, b) => {
        if (a.isBelowMin && !b.isBelowMin) return -1;
        if (!a.isBelowMin && b.isBelowMin) return 1;
        return a.priceGap - b.priceGap;
      });

      setProducts(allProducts);
    } catch (err) {
      console.error('Min price load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (Math.abs(price) >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
    if (Math.abs(price) >= 1000) return (price / 1000).toFixed(0) + ' ming';
    return new Intl.NumberFormat('uz-UZ').format(Math.round(price));
  };

  const toggleProductProtection = (productId: string, marketplace: string) => {
    setProducts(prev => prev.map(p =>
      p.id === productId && p.marketplace === marketplace
        ? { ...p, isProtected: !p.isProtected }
        : p
    ));
  };

  const setCustomMinPrice = (productId: string, marketplace: string, value: number) => {
    setProducts(prev => prev.map(p =>
      p.id === productId && p.marketplace === marketplace
        ? {
          ...p,
          customMinPrice: value,
          minPrice: value,
          isBelowMin: p.currentPrice < value,
          priceGap: p.currentPrice - value,
        }
        : p
    ));
  };

  const belowMinCount = products.filter(p => p.isBelowMin).length;
  const protectedCount = products.filter(p => p.isProtected).length;
  const safeCount = products.filter(p => !p.isBelowMin && p.currentPrice > 0).length;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Minimal narx himoyasi</h3>
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
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={belowMinCount > 0 ? 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-sm font-medium">Xavfli</span>
            </div>
            <div className="text-2xl font-bold">{belowMinCount}</div>
            <div className="text-xs text-muted-foreground">min narxdan past</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-medium">Xavfsiz</span>
            </div>
            <div className="text-2xl font-bold">{safeCount}</div>
            <div className="text-xs text-muted-foreground">normal narxda</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">Himoyalangan</span>
            </div>
            <div className="text-2xl font-bold">{protectedCount}</div>
            <div className="text-xs text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Percent className="h-4 w-4" />
              <span className="text-sm font-medium">Min foyda</span>
            </div>
            <div className="text-2xl font-bold text-primary">{defaultMargin}%</div>
            <div className="text-xs text-muted-foreground">belgilangan</div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Himoya sozlamalari
          </CardTitle>
          <CardDescription>
            Narx avtomatik tushirilganda zarar ko'rmaslik uchun chegaralar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Himoya</span>
                <Switch
                  checked={globalProtection}
                  onCheckedChange={(val) => {
                    setGlobalProtection(val);
                    setProducts(prev => prev.map(p => ({ ...p, isProtected: val })));
                    toast.success(val ? 'Himoya yoqildi' : 'Himoya o\'chirildi');
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Global himoya</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <label className="text-sm font-medium">Min foyda %</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={defaultMargin}
                  onChange={(e) => setDefaultMargin(Number(e.target.value))}
                  className="h-8"
                  min={0}
                  max={100}
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <label className="text-sm font-medium">Tannarx %</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={costPercent}
                  onChange={(e) => setCostPercent(Number(e.target.value))}
                  className="h-8"
                  min={0}
                  max={100}
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <label className="text-sm font-medium">Komissiya %</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={commissionPercent}
                  className="h-8"
                  disabled
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <label className="text-sm font-medium">Logistika %</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={logisticsPercent}
                  onChange={(e) => setLogisticsPercent(Number(e.target.value))}
                  className="h-8"
                  min={0}
                  max={100}
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Formula */}
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-sm font-medium mb-1">📐 Min narx formulasi:</div>
            <code className="text-xs text-muted-foreground">
              Min narx = (Tannarx {costPercent}% + Komissiya {commissionPercent}% + Logistika {logisticsPercent}%) ÷ (1 - Min foyda {defaultMargin}%)
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Mahsulotlar narx himoyasi
                {belowMinCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {belowMinCount} xavfli
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{products.length} ta mahsulot tekshirildi</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadProducts} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Mahsulotlar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">🛡️</TableHead>
                    <TableHead className="min-w-[180px]">Mahsulot</TableHead>
                    <TableHead className="w-16 text-center">MP</TableHead>
                    <TableHead className="w-28 text-right">Joriy narx</TableHead>
                    <TableHead className="w-24 text-right">Tannarx</TableHead>
                    <TableHead className="w-20 text-right">Komissiya</TableHead>
                    <TableHead className="w-28 text-right">Min narx</TableHead>
                    <TableHead className="w-20 text-center">Holat</TableHead>
                    <TableHead className="w-20 text-right">Farq</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.slice(0, 100).map((product) => (
                    <TableRow
                      key={`${product.id}-${product.marketplace}`}
                      className={product.isBelowMin ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleProductProtection(product.id, product.marketplace)}
                        >
                          {product.isProtected ? (
                            <Lock className="h-4 w-4 text-green-600" />
                          ) : (
                            <Unlock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
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
                      <TableCell className="text-right font-medium">{formatPrice(product.currentPrice)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatPrice(product.costPrice)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatPrice(product.commissionAmount)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-sm text-primary">{formatPrice(product.minPrice)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {product.isBelowMin ? (
                          <Badge variant="destructive" className="text-xs">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Xavfli
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-medium ${product.priceGap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {product.priceGap >= 0 ? '+' : ''}{formatPrice(product.priceGap)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {products.length > 100 && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  Ko'rsatilmoqda: 100 / {products.length}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
