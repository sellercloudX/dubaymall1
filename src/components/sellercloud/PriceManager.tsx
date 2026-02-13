import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Calculator, RefreshCw, Save, AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCostPrices } from '@/hooks/useCostPrices';
import { useMarketplaceTariffs, getTariffForProduct } from '@/hooks/useMarketplaceTariffs';
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
  newPrice: number;
  marketplace: string;
  costPrice: number | null;
  tariffFee: number;
  isRealTariff: boolean;
  minPrice: number;
}

export function PriceManager({ connectedMarketplaces, store }: PriceManagerProps) {
  const [autoPricing, setAutoPricing] = useState(false);
  const [minProfit, setMinProfit] = useState(15);
  const [priceChanges, setPriceChanges] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { getCostPrice } = useCostPrices();
  const { data: tariffMap, isLoading: tariffsLoading } = useMarketplaceTariffs(connectedMarketplaces, store);
  const isLoading = store.isLoadingProducts || tariffsLoading;

  const products = useMemo(() => {
    const allProducts: ProductPrice[] = [];
    for (const marketplace of connectedMarketplaces) {
      store.getProducts(marketplace).forEach(product => {
        const price = product.price || 0;
        const costPrice = getCostPrice(marketplace, product.offerId);
        const tariff = getTariffForProduct(tariffMap, product.offerId, price);
        
        // Min price calculation: use COST PRICE as base for tariff estimation
        // to avoid circular dependency (price -> tariff -> minPrice -> price)
        // Formula: minPrice = costPrice / (1 - tariffPercent - taxPercent - marginPercent)
        let calculatedMinPrice = 0;
        if (costPrice !== null && costPrice > 0) {
          // Get tariff percent from real data or estimate
          const tariffPercent = tariff.isReal && price > 0
            ? tariff.totalFee / price  // real tariff as fraction of price
            : 0.15; // fallback 15%
          const taxPercent = 0.04;
          const marginPercent = minProfit / 100;
          const denominator = 1 - tariffPercent - taxPercent - marginPercent;
          if (denominator > 0.05) { // safety: don't divide by near-zero
            calculatedMinPrice = Math.ceil(costPrice / denominator);
          }
        }

        allProducts.push({
          id: product.offerId,
          name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId,
          price,
          newPrice: priceChanges[`${marketplace}-${product.offerId}`] || price,
          marketplace,
          costPrice,
          tariffFee: tariff.totalFee,
          isRealTariff: tariff.isReal,
          minPrice: calculatedMinPrice,
        });
      });
    }
    return allProducts;
  }, [connectedMarketplaces, store.dataVersion, getCostPrice, tariffMap, minProfit, priceChanges]);

  const filteredProducts = searchQuery 
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const changedProducts = products.filter(p => {
    const key = `${p.marketplace}-${p.id}`;
    return priceChanges[key] && priceChanges[key] !== p.price;
  });

  const handlePriceChange = (marketplace: string, offerId: string, newPrice: number) => {
    setPriceChanges(prev => ({ ...prev, [`${marketplace}-${offerId}`]: newPrice }));
  };

  const handleAutoPrice = () => {
    const newChanges: Record<string, number> = {};
    products.forEach(p => {
      if (p.costPrice !== null && p.minPrice > 0 && p.price < p.minPrice) {
        newChanges[`${p.marketplace}-${p.id}`] = p.minPrice;
      }
    });
    setPriceChanges(prev => ({ ...prev, ...newChanges }));
    const count = Object.keys(newChanges).length;
    if (count > 0) {
      toast.info(`${count} ta mahsulot narxi minimal foydaga moslanadi`);
    } else {
      toast.success('Barcha narxlar yetarli darajada');
    }
  };

  const handleSavePrices = async () => {
    if (changedProducts.length === 0) {
      toast.info("O'zgartirish yo'q");
      return;
    }

    setIsSaving(true);
    try {
      // Group by marketplace
      const byMarketplace = new Map<string, Array<{ offerId: string; price: number }>>();
      changedProducts.forEach(p => {
        const key = `${p.marketplace}-${p.id}`;
        const newPrice = priceChanges[key];
        if (!newPrice || newPrice === p.price) return;
        
        const list = byMarketplace.get(p.marketplace) || [];
        list.push({ offerId: p.id, price: newPrice });
        byMarketplace.set(p.marketplace, list);
      });

      for (const [marketplace, offers] of byMarketplace) {
        const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
          body: {
            marketplace,
            dataType: 'update-prices',
            offers,
          },
        });

        if (error || !data?.success) {
          toast.error(`${MARKETPLACE_NAMES[marketplace]}: Narx yangilashda xato — ${data?.error || error?.message}`);
          continue;
        }

        toast.success(`${MARKETPLACE_NAMES[marketplace]}: ${offers.length} ta mahsulot narxi yangilandi`);
      }

      setPriceChanges({});
      // Refresh products after price update
      setTimeout(() => store.refetchProducts(), 2000);
    } catch (e) {
      toast.error('Narx yangilashda xato yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('uz-UZ').format(price);
  };

  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + p.price, 0) / products.length : 0;
  const belowMinCount = products.filter(p => p.costPrice !== null && p.minPrice > 0 && p.price < p.minPrice).length;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Narxlar boshqaruvi</h3>
        <p className="text-muted-foreground">Avval marketplace ulang</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium truncate">Jami mahsulot</span>
            </div>
            {isLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-xl font-bold">{products.length}</div>}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Calculator className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium truncate">O'rtacha narx</span>
            </div>
            {isLoading ? <Skeleton className="h-7 w-24" /> : <div className="text-xl font-bold truncate">{formatPrice(Math.round(avgPrice))}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Below min price warning */}
      {belowMinCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive">
            {belowMinCount} ta mahsulot minimal foydadan past narxda!
          </span>
        </div>
      )}

      {/* Auto Pricing */}
      <Card className="overflow-hidden">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">Avtomatik narxlash</div>
              <div className="text-xs text-muted-foreground">Tannarx + tarif + soliq asosida</div>
            </div>
            <Switch checked={autoPricing} onCheckedChange={setAutoPricing} />
          </div>
          {autoPricing && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Minimal foyda %</div>
                  <Input type="number" value={minProfit} onChange={(e) => setMinProfit(Number(e.target.value))} className="h-8 text-sm" min={0} max={100} />
                </div>
                <Button size="sm" variant="outline" onClick={handleAutoPrice} className="shrink-0 mt-4">
                  <Calculator className="h-3.5 w-3.5 mr-1" />Hisoblash
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      {changedProducts.length > 0 && (
        <Button onClick={handleSavePrices} disabled={isSaving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saqlanmoqda...' : `${changedProducts.length} ta narxni Yandex'ga saqlash`}
        </Button>
      )}

      {/* Search */}
      <Input 
        placeholder="Mahsulot qidirish..." 
        value={searchQuery} 
        onChange={e => setSearchQuery(e.target.value)}
        className="h-9"
      />

      {/* Products Price List */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-sm">Narxlar</CardTitle>
              <CardDescription className="text-xs">{filteredProducts.length} ta mahsulot</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => store.refetchProducts()} disabled={store.isFetching} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${store.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredProducts.slice(0, 50).map(product => {
                const key = `${product.marketplace}-${product.id}`;
                const hasChange = priceChanges[key] && priceChanges[key] !== product.price;
                const isBelowMin = product.costPrice !== null && product.minPrice > 0 && (priceChanges[key] || product.price) < product.minPrice;
                
                return (
                  <div key={key} className={`p-3 rounded-lg border space-y-2 ${isBelowMin ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg border bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                          {(() => {
                            const storeProduct = store.getProducts(product.marketplace).find(p => p.offerId === product.id);
                            const imgUrl = storeProduct?.pictures?.[0];
                            return imgUrl ? (
                              <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground/40" />
                            );
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium line-clamp-1">{product.name}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{MARKETPLACE_NAMES[product.marketplace]}</Badge>
                            <code className="text-[10px] text-muted-foreground">{product.sku}</code>
                            {product.isRealTariff && (
                              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Tarif
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Hozirgi narx</div>
                        <div className="text-sm font-bold">{formatPrice(product.price)} so'm</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Yangi narx</div>
                        <Input 
                          type="number" 
                          value={priceChanges[key] || product.price}
                          onChange={e => handlePriceChange(product.marketplace, product.id, Number(e.target.value))}
                          className={`h-7 text-sm ${hasChange ? 'border-primary' : ''}`}
                        />
                      </div>
                    </div>
                    {product.costPrice !== null && (
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Tannarx: {formatPrice(product.costPrice)}</span>
                        <span>Tarif: {formatPrice(Math.round(product.tariffFee))}</span>
                        {product.minPrice > 0 && <span>Min: {formatPrice(product.minPrice)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredProducts.length > 50 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  50 / {filteredProducts.length} ko'rsatilmoqda
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
