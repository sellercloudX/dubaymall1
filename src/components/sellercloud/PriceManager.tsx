import { useState, useMemo } from 'react';
import { MarketplaceLogo } from '@/lib/marketplaceConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Calculator, RefreshCw, Save, AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toDisplayUzs, toMarketplaceCurrency } from '@/lib/currency';
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

// All prices in SellerCloudX are displayed in UZS (so'm)
const formatPriceUzs = (price: number | undefined) => {
  if (!price && price !== 0) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(price)) + " so'm";
};

interface ProductPrice {
  id: string;
  nmID?: number;
  skuId?: string; // Uzum numeric SKU ID for API calls
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
  const [selectedMp, setSelectedMp] = useState(connectedMarketplaces[0] || '');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const { getCostPrice, refetch: refetchCostPrices } = useCostPrices();
  const { data: tariffMap, isLoading: tariffsLoading } = useMarketplaceTariffs(connectedMarketplaces, store);
  const isLoading = store.isLoadingProducts || tariffsLoading;

  const activeMarketplaces = selectedMp ? [selectedMp] : connectedMarketplaces;

  const products = useMemo(() => {
    const allProducts: ProductPrice[] = [];
    for (const marketplace of activeMarketplaces) {
      store.getProducts(marketplace).forEach(product => {
        const rawPrice = product.price || 0;
        // Convert price to UZS for display
        const priceUzs = toDisplayUzs(rawPrice, marketplace);
        const rawCostPrice = getCostPrice(marketplace, product.offerId);
        // Cost price for WB is stored in RUB, convert to UZS
        const costPriceUzs = rawCostPrice !== null ? toDisplayUzs(rawCostPrice, marketplace) : null;
        // Tariffs are already in UZS (converted in useMarketplaceTariffs)
        const tariff = getTariffForProduct(tariffMap, product.offerId, priceUzs, marketplace);
        
        // Min price formula: markup-based for any margin %
        let calculatedMinPrice = 0;
        if (costPriceUzs !== null && costPriceUzs > 0) {
          const rawCommissionShare = priceUzs > 0 ? (tariff.commission / priceUzs) : 0;
          const commissionPercent = rawCommissionShare > 0 && rawCommissionShare < 0.8 ? rawCommissionShare : 0.15;
          const logisticsCost = tariff.logistics > 0 && tariff.logistics < priceUzs * 0.9
            ? tariff.logistics
            : (marketplace === 'wildberries' ? (priceUzs > 700000 ? 14000 : priceUzs > 140000 ? 7000 : 4200) : 3000);
          const taxPercent = 0.04;
          const marginPercent = minProfit / 100;

          // Use margin formula when denominator is positive, otherwise use markup formula
          const denominator = 1 - commissionPercent - taxPercent - marginPercent;
          if (denominator > 0.05) {
            calculatedMinPrice = Math.ceil((costPriceUzs + logisticsCost) / denominator);
          } else {
            // Markup approach: Price = (Cost + Logistics) * (1 + margin) / (1 - commission - tax)
            const costBase = costPriceUzs + logisticsCost;
            const feesDenom = 1 - commissionPercent - taxPercent;
            if (feesDenom > 0.05) {
              calculatedMinPrice = Math.ceil(costBase * (1 + marginPercent) / feesDenom);
            }
          }
        }

        allProducts.push({
          id: product.offerId,
          nmID: (product as any).nmID,
          skuId: product.skuId, // Uzum numeric SKU ID
          name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId,
          price: priceUzs,
          newPrice: priceChanges[`${marketplace}-${product.offerId}`] || priceUzs,
          marketplace,
          costPrice: costPriceUzs,
          tariffFee: tariff.totalFee,
          isRealTariff: tariff.isReal,
          minPrice: calculatedMinPrice,
        });
      });
    }
    return allProducts;
  }, [activeMarketplaces, store.dataVersion, getCostPrice, tariffMap, minProfit, priceChanges]);

  const filteredProducts = searchQuery
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const changedProducts = products.filter(p => {
    const key = `${p.marketplace}-${p.id}`;
    return priceChanges[key] !== undefined && priceChanges[key] !== p.price;
  });

  const handlePriceChange = (marketplace: string, offerId: string, newPrice: number) => {
    setPriceChanges(prev => ({ ...prev, [`${marketplace}-${offerId}`]: newPrice }));
  };

  const handleAutoPrice = () => {
    const normalizedProfit = Math.max(0, Number.isFinite(minProfit) ? minProfit : 0);

    const newChanges: Record<string, number> = {};
    let noCostCount = 0;
    let changedCount = 0;
    let uncomputableCount = 0;

    products.forEach(p => {
      if (p.costPrice === null || p.costPrice <= 0) {
        noCostCount++;
        return;
      }
      if (p.minPrice <= 0) {
        uncomputableCount++;
        return;
      }

      const key = `${p.marketplace}-${p.id}`;
      const target = Math.round(p.minPrice);
      newChanges[key] = target;
      changedCount++;
    });

    // Always replace with fresh calculation
    setPriceChanges(newChanges);

    if (changedCount > 0) {
      toast.success(`${changedCount} ta mahsulot narxi ${normalizedProfit}% foydaga moslandi`);
    }
    if (noCostCount > 0) {
      toast.warning(`${noCostCount} ta mahsulotda tannarx kiritilmagan`);
    }
    if (uncomputableCount > 0) {
      toast.warning(`${uncomputableCount} ta mahsulotda tarif hisoblab bo'lmadi`);
    }
    if (changedCount === 0 && noCostCount === 0 && uncomputableCount === 0) {
      toast.info("Mahsulotlar topilmadi");
    }
  };

  const handleSavePrices = async () => {
    if (changedProducts.length === 0) {
      toast.info("O'zgartirish yo'q");
      return;
    }

    setIsSaving(true);
    try {
      // Group by marketplace — convert UZS prices back to marketplace currency (RUB for WB)
      const byMarketplace = new Map<string, Array<{ offerId: string; price: number; nmID?: number; skuId?: string }>>();
      changedProducts.forEach(p => {
        const key = `${p.marketplace}-${p.id}`;
        const newPriceUzs = priceChanges[key];
        if (newPriceUzs === undefined || newPriceUzs === p.price) return;

        const list = byMarketplace.get(p.marketplace) || [];
        // Convert from UZS display price back to marketplace-native currency
        const nativePrice = toMarketplaceCurrency(newPriceUzs, p.marketplace);
        list.push({ offerId: p.id, price: nativePrice, nmID: p.nmID, skuId: p.skuId });
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

        // Show quarantine warning if any
        if (data?.quarantineWarning) {
          toast.warning(data.quarantineWarning, { duration: 15000 });
        } else if (data?.quarantineCount > 0) {
          toast.warning(`${data.quarantineCount} ta mahsulot karantinga tushdi. WB seller kabinetidan tasdiqlang.`, { duration: 10000 });
        }

        // Show task status info
        if (data?.taskStatus?.status === 5 || data?.taskStatus?.status === 6) {
          toast.error(`${MARKETPLACE_NAMES[marketplace]}: Narxlar yuborildi, lekin xatolar bor. Karantin tekshiring.`, { duration: 10000 });
        } else {
          toast.success(`${MARKETPLACE_NAMES[marketplace]}: ${offers.length} ta mahsulot narxi yangilandi`);
        }
      }

      setPriceChanges({});
      await refetchCostPrices();
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
    return formatPriceUzs(price);
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
      {/* Marketplace Filter */}
      {connectedMarketplaces.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {connectedMarketplaces.map(mp => (
            <Button key={mp} variant={selectedMp === mp ? 'default' : 'outline'} size="sm"
              onClick={() => {
                setSelectedMp(mp);
                setCurrentPage(1);
                setSearchQuery('');
              }} className="shrink-0 text-xs">
              <MarketplaceLogo marketplace={mp} size={14} className="mr-1" /> {MARKETPLACE_NAMES[mp]}
            </Button>
          ))}
        </div>
      )}

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
      {(() => {
        const noCostCount = products.filter(p => p.costPrice === null || p.costPrice <= 0).length;
        return noCostCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <span className="text-xs text-yellow-700 dark:text-yellow-400">
              {noCostCount} ta mahsulotda tannarx kiritilmagan — aniq hisoblash uchun tannarx kiriting
            </span>
          </div>
        ) : null;
      })()}

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
                  <Input type="number" value={minProfit} onChange={(e) => setMinProfit(Number(e.target.value))} className="h-8 text-sm" min={0} />
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
          {isSaving ? 'Saqlanmoqda...' : `${changedProducts.length} ta narxni ${MARKETPLACE_NAMES[selectedMp] || 'marketplace'}ga saqlash`}
        </Button>
      )}

      {/* Search */}
      <Input 
        placeholder="Mahsulot qidirish..." 
        value={searchQuery} 
        onChange={e => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
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
              {paginatedProducts.map(product => {
                const key = `${product.marketplace}-${product.id}`;
                const hasChange = priceChanges[key] !== undefined && priceChanges[key] !== product.price;
                const isBelowMin = product.costPrice !== null && product.minPrice > 0 && (priceChanges[key] ?? product.price) < product.minPrice;
                
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
                        <div className="text-sm font-bold">{formatPrice(product.price)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Yangi narx</div>
                        <Input 
                          type="number" 
                          value={priceChanges[key] ?? product.price}
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
              {filteredProducts.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>
                    Oldingi
                  </Button>
                  <span>
                    {(safePage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(safePage * ITEMS_PER_PAGE, filteredProducts.length)} / {filteredProducts.length}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                    Keyingi
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
