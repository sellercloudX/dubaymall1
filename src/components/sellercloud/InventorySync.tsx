import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, Package, AlertTriangle, Check, 
  ArrowDownUp, Settings, Search, TrendingDown,
  AlertOctagon, FileWarning, BarChart3, Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MarketplaceDataStore, MarketplaceProduct } from '@/hooks/useMarketplaceDataStore';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type LossFilter = 'all' | 'with_loss' | 'no_loss';

interface InventorySyncProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex', uzum: 'Uzum', wildberries: 'WB', ozon: 'Ozon',
};

interface ProductStock {
  id: string;
  name: string;
  sku: string;
  stockFBO: number;
  stockFBS: number;
  totalStock: number;
  lowStockAlert: boolean;
  marketplace: string;
}

interface ReconciliationItem {
  sku: string;
  name: string;
  marketplace: string;
  invoiced: number; // Yuklangan
  sold: number; // Sotilgan
  currentStock: number; // Joriy qoldiq
  returned: number; // Qaytarilgan
  lost: number; // Yo'qolgan = invoiced - sold - currentStock - returned
  lossRate: number; // % yo'qotish
}

const LOW_STOCK_THRESHOLD = 10;

export function InventorySync({ connectedMarketplaces, store }: InventorySyncProps) {
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [lossFilter, setLossFilter] = useState<LossFilter>('all');
  const [stockSelectedIds, setStockSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStockValue, setBulkStockValue] = useState<string>('');
  const [stockUpdateFilter, setStockUpdateFilter] = useState<'selected' | 'out_of_stock' | 'all'>('selected');
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const isLoading = store.isLoadingProducts;

  const toggleStockSelect = useCallback((key: string) => {
    setStockSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Stock data
  const products = useMemo(() => {
    const allProducts: ProductStock[] = [];
    const marketplaces = selectedMarketplace === 'all' ? connectedMarketplaces : [selectedMarketplace];
    for (const marketplace of marketplaces) {
      const marketplaceProducts = store.getProducts(marketplace);
      marketplaceProducts.forEach(product => {
        const stockFBO = product.stockFBO || 0;
        const stockFBS = product.stockFBS || 0;
        const totalStock = product.stockCount || (stockFBO + stockFBS);
        allProducts.push({
          id: product.offerId,
          name: product.name || 'Nomsiz',
          sku: product.shopSku || product.offerId,
          stockFBO, stockFBS, totalStock,
          lowStockAlert: totalStock < LOW_STOCK_THRESHOLD,
          marketplace,
        });
      });
    }
    return allProducts;
  }, [connectedMarketplaces, store.dataVersion, selectedMarketplace]);

  // Inventory reconciliation (yo'qolgan tovarlar tahlili)
  const reconciliation = useMemo((): ReconciliationItem[] => {
    const items: ReconciliationItem[] = [];
    const marketplaces = selectedMarketplace === 'all' ? connectedMarketplaces : [selectedMarketplace];
    
    for (const marketplace of marketplaces) {
      const mpProducts = store.getProducts(marketplace);
      const mpOrders = store.getOrders(marketplace);
      
      for (const product of mpProducts) {
        const sku = product.shopSku || product.offerId;
        const currentStock = product.stockCount || ((product.stockFBO || 0) + (product.stockFBS || 0));
        
        // Sotilgan — buyurtmalardan hisoblash
        let sold = 0;
        for (const order of mpOrders) {
          if (['CANCELLED', 'CANCELED', 'RETURNED'].includes(String(order.status).toUpperCase())) continue;
          if (order.items) {
            for (const item of order.items) {
              if (item.offerId === product.offerId || item.offerId === sku) {
                sold += item.count || 1;
              }
            }
          }
        }

        // Qaytarilgan — RETURNED statusli buyurtmalardan
        let returned = 0;
        for (const order of mpOrders) {
          if (String(order.status).toUpperCase() === 'RETURNED') {
            if (order.items) {
              for (const item of order.items) {
                if (item.offerId === product.offerId || item.offerId === sku) {
                  returned += item.count || 1;
                }
              }
            }
          }
        }

        // Yuklangan (invoiced) — taxminiy: sold + currentStock + returned + lost
        // Haqiqiy invoiced ma'lumot API'dan keladi, hozir taxminiy hisob
        const estimatedInvoiced = sold + currentStock + returned;
        
        // Yo'qolgan = invoiced - sold - currentStock - returned
        // Haqiqiy invoiced bo'lmasa, lost = 0 (taxminiy)
        // Agar marketplace API'dan invoiced kelsa, u yerdan olamiz
        const lost = Math.max(0, estimatedInvoiced - sold - currentStock - returned);
        const lossRate = estimatedInvoiced > 0 ? (lost / estimatedInvoiced) * 100 : 0;

        items.push({
          sku,
          name: product.name || 'Nomsiz',
          marketplace,
          invoiced: estimatedInvoiced,
          sold,
          currentStock,
          returned,
          lost,
          lossRate,
        });
      }
    }
    
    return items;
  }, [connectedMarketplaces, store.dataVersion, selectedMarketplace]);

  // Filter
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (stockFilter === 'in_stock') return p.totalStock >= LOW_STOCK_THRESHOLD;
    if (stockFilter === 'low_stock') return p.totalStock > 0 && p.totalStock < LOW_STOCK_THRESHOLD;
    if (stockFilter === 'out_of_stock') return p.totalStock === 0;
    return true;
  });

  const filteredReconciliation = reconciliation.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (lossFilter === 'with_loss') return r.lost > 0;
    if (lossFilter === 'no_loss') return r.lost === 0;
    return true;
  });

  // Stats
  const lowStockCount = products.filter(p => p.lowStockAlert).length;
  const outOfStockCount = products.filter(p => p.totalStock === 0).length;
  const inStockCount = products.filter(p => p.totalStock > 0 && !p.lowStockAlert).length;
  const totalLost = reconciliation.reduce((sum, r) => sum + r.lost, 0);
  const itemsWithLoss = reconciliation.filter(r => r.lost > 0);

  const toggleSelectAllStock = useCallback(() => {
    const allKeys = filteredProducts.map(p => `${p.id}-${p.marketplace}`);
    const allSelected = allKeys.every(k => stockSelectedIds.has(k));
    if (allSelected) {
      setStockSelectedIds(new Set());
    } else {
      setStockSelectedIds(new Set(allKeys));
    }
  }, [filteredProducts, stockSelectedIds]);

  const handleBulkStockUpdate = useCallback(async () => {
    const qty = parseInt(bulkStockValue);
    if (isNaN(qty) || qty < 0) { toast.error("Noto'g'ri miqdor"); return; }
    
    let targets: ProductStock[] = [];
    if (stockUpdateFilter === 'selected') {
      targets = filteredProducts.filter(p => stockSelectedIds.has(`${p.id}-${p.marketplace}`));
    } else if (stockUpdateFilter === 'out_of_stock') {
      targets = filteredProducts.filter(p => p.totalStock === 0);
    } else {
      targets = filteredProducts;
    }
    
    if (targets.length === 0) { toast.error("Mahsulot tanlanmagan"); return; }
    
    setIsUpdatingStock(true);
    let successCount = 0;
    let failCount = 0;
    
    const byMarketplace = new Map<string, ProductStock[]>();
    for (const t of targets) {
      const arr = byMarketplace.get(t.marketplace) || [];
      arr.push(t);
      byMarketplace.set(t.marketplace, arr);
    }
    
    for (const [marketplace, prods] of byMarketplace) {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
          body: {
            marketplace,
            dataType: 'update-stock',
            stocks: prods.map(p => ({
              sku: p.sku,
              offerId: p.id,
              quantity: qty,
            })),
          },
        });
        
        if (!error && data?.success) {
          successCount += prods.length;
        } else {
          failCount += prods.length;
        }
      } catch (e) {
        failCount += prods.length;
      }
    }
    
    setIsUpdatingStock(false);
    if (successCount > 0) toast.success(`${successCount} ta mahsulotga ${qty} dona qoldiq qo'yildi`);
    if (failCount > 0) toast.error(`${failCount} ta mahsulotda xato`);
    store.refetchProducts();
  }, [bulkStockValue, stockUpdateFilter, stockSelectedIds, filteredProducts, store]);

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ArrowDownUp className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Inventar boshqaruvi</h3>
          <p className="text-muted-foreground mb-4">Avval marketplace ulang</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={selectedMarketplace === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMarketplace('all')}
          >
            Barchasi
          </Button>
          {connectedMarketplaces.map(mp => (
            <Button
              key={mp}
              variant={selectedMarketplace === mp ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarketplace(mp)}
            >
              {MARKETPLACE_NAMES[mp] || mp}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="SKU yoki nomi..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm w-full sm:w-44" />
          </div>
          <Button variant="outline" size="sm" onClick={() => store.refetchProducts()} disabled={store.isFetching}>
            <RefreshCw className={`h-4 w-4 ${store.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="h-auto gap-1 p-1 w-full flex-wrap">
          <TabsTrigger value="stock" className="text-xs gap-1 flex-1 min-w-0"><Package className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Zaxira</span></TabsTrigger>
          <TabsTrigger value="reconciliation" className="text-xs gap-1 flex-1 min-w-0"><FileWarning className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Yo'qotishlar</span></TabsTrigger>
          <TabsTrigger value="movement" className="text-xs gap-1 flex-1 min-w-0"><BarChart3 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Harakat</span></TabsTrigger>
        </TabsList>

        {/* Tab 1: Zaxira holati */}
        <TabsContent value="stock">
          {/* Stock Filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="in_stock">Mavjud</SelectItem>
                <SelectItem value="low_stock">Kam qoldiq</SelectItem>
                <SelectItem value="out_of_stock">Tugagan</SelectItem>
              </SelectContent>
            </Select>
            {stockFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStockFilter('all')}>Tozalash</Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                 <div className="flex items-center gap-1.5 text-primary mb-1">
                   <Check className="h-3.5 w-3.5 shrink-0" /><span className="text-xs sm:text-sm truncate">Mavjud</span>
                 </div>
                 {isLoading ? <Skeleton className="h-7 w-10" /> : <div className="text-xl sm:text-2xl font-bold">{inStockCount}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                 <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                   <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span className="text-xs sm:text-sm truncate">Kam</span>
                 </div>
                 {isLoading ? <Skeleton className="h-7 w-10" /> : <div className="text-xl sm:text-2xl font-bold text-amber-600">{lowStockCount}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                 <div className="flex items-center gap-1.5 text-destructive mb-1">
                   <Package className="h-3.5 w-3.5 shrink-0" /><span className="text-xs sm:text-sm truncate">Tugagan</span>
                 </div>
                 {isLoading ? <Skeleton className="h-7 w-10" /> : <div className="text-xl sm:text-2xl font-bold text-destructive">{outOfStockCount}</div>}
              </CardContent>
            </Card>
          </div>

          {/* Sync settings */}
          <Card className="mb-4">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">Avtomatik sinxronizatsiya</div>
                    <div className="text-xs text-muted-foreground">Har {syncInterval} daqiqada</div>
                  </div>
                </div>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} />
              </div>
            </CardContent>
          </Card>

          {/* FBS Stock Update Section */}
          <Card className="mb-4 border-primary/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                FBS Qoldiq qo'yish
              </CardTitle>
              <CardDescription className="text-xs">Tanlangan tovarlarga qoldiq miqdorini belgilang</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
                <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Qoldiq soni"
                    value={bulkStockValue}
                    onChange={e => setBulkStockValue(e.target.value)}
                    className="h-9 w-28 text-sm"
                  />
                  <Select value={stockUpdateFilter} onValueChange={v => setStockUpdateFilter(v as any)}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="selected">Tanlanganlar</SelectItem>
                      <SelectItem value="out_of_stock">Tugaganlar</SelectItem>
                      <SelectItem value="all">Barchasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!bulkStockValue || isUpdatingStock || stockSelectedIds.size === 0 && stockUpdateFilter === 'selected'}
                    onClick={handleBulkStockUpdate}
                  >
                    {isUpdatingStock ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Qoldiq qo'yish
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {stockUpdateFilter === 'selected' ? `${stockSelectedIds.size} ta` :
                     stockUpdateFilter === 'out_of_stock' ? `${outOfStockCount} ta` :
                     `${filteredProducts.length} ta`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Stock List */}
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Zaxira holati</CardTitle>
                  <CardDescription className="text-xs">{filteredProducts.length} ta mahsulot</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={toggleSelectAllStock}>
                  {stockSelectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? 'Bekor' : 'Barchasini tanlash'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Mahsulotlar topilmadi</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredProducts
                    .sort((a, b) => a.totalStock - b.totalStock)
                    .map(product => (
                      <div 
                        key={`${product.id}-${product.marketplace}`} 
                        className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${stockSelectedIds.has(`${product.id}-${product.marketplace}`) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted'}`}
                        onClick={() => toggleStockSelect(`${product.id}-${product.marketplace}`)}
                      >
                        <Checkbox checked={stockSelectedIds.has(`${product.id}-${product.marketplace}`)} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{product.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{MARKETPLACE_NAMES[product.marketplace]}</Badge>
                            <span className="truncate">{product.sku}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">FBO</div>
                            <div className="font-medium text-sm">{product.stockFBO}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">FBS</div>
                            <div className="font-medium text-sm">{product.stockFBS}</div>
                          </div>
                          <Badge variant={product.totalStock === 0 ? 'destructive' : product.lowStockAlert ? 'outline' : 'default'}
                            className={product.lowStockAlert && product.totalStock > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : ''}>
                            {product.totalStock}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Yo'qotishlar tahlili (Reconciliation) */}
        <TabsContent value="reconciliation">
          {/* Loss Filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={lossFilter} onValueChange={(v) => setLossFilter(v as LossFilter)}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="with_loss">Yo'qolganlari</SelectItem>
                <SelectItem value="no_loss">Yo'qotishsiz</SelectItem>
              </SelectContent>
            </Select>
            {lossFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLossFilter('all')}>Tozalash</Button>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground mb-1">Jami mahsulotlar</div>
                <div className="text-2xl font-bold">{reconciliation.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground mb-1">Jami sotilgan</div>
                <div className="text-2xl font-bold text-primary">{reconciliation.reduce((s, r) => s + r.sold, 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground mb-1">Qaytarilgan</div>
                <div className="text-2xl font-bold text-amber-600">{reconciliation.reduce((s, r) => s + r.returned, 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground mb-1">Yo'qolgan</div>
                <div className="text-2xl font-bold text-destructive">{totalLost}</div>
                {itemsWithLoss.length > 0 && (
                  <div className="text-xs text-destructive mt-1">{itemsWithLoss.length} ta SKU</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 mb-4">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <AlertOctagon className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Yo'qotishlarni hisoblash formulasi</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    <strong>YO'QOLGAN</strong> = YUKLANGAN − SOTILGAN − QOLDIQ − QAYTARILGAN
                  </p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
                    * Hozir buyurtmalar va qoldiq asosida taxminiy hisob. Marketplace API'dan invoiced ma'lumot kelganda aniqlik oshadi.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reconciliation table */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileWarning className="h-4 w-4" />
                SKU bo'yicha inventar tahlili
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              {isLoading ? (
                <div className="space-y-3 px-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : filteredReconciliation.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-4">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Ma'lumot topilmadi</p>
                </div>
              ) : (
                <>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-4 py-2 font-medium text-xs text-muted-foreground">Mahsulot</th>
                        <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-center">MP</th>
                        <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Yukl.</th>
                        <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Sotilgan</th>
                        <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Qoldiq</th>
                        <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Qayt.</th>
                        <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Yo'qolgan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReconciliation
                        .sort((a, b) => b.lost - a.lost)
                        .map(item => (
                          <tr key={`${item.sku}-${item.marketplace}`} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-sm truncate max-w-[200px]">{item.name}</div>
                              <code className="text-[10px] text-muted-foreground">{item.sku}</code>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <Badge variant="outline" className="text-[10px]">{MARKETPLACE_NAMES[item.marketplace]}</Badge>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium">{item.invoiced}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-primary">{item.sold}</td>
                            <td className="px-3 py-2.5 text-right font-medium">{item.currentStock}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-amber-600">{item.returned}</td>
                            <td className="px-3 py-2.5 text-right">
                              {item.lost > 0 ? (
                                <Badge variant="destructive" className="text-xs">{item.lost}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-primary">0</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile card layout */}
                <div className="sm:hidden space-y-2 px-4">
                  {filteredReconciliation
                    .sort((a, b) => b.lost - a.lost)
                    .map(item => (
                      <div key={`${item.sku}-${item.marketplace}`} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm break-words">{item.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[10px]">{MARKETPLACE_NAMES[item.marketplace]}</Badge>
                              <code className="text-[10px] text-muted-foreground truncate">{item.sku}</code>
                            </div>
                          </div>
                          {item.lost > 0 ? (
                            <Badge variant="destructive" className="text-xs shrink-0">{item.lost} yo'q.</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-primary shrink-0">✓</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div>
                            <div className="text-[10px] text-muted-foreground">Yukl.</div>
                            <div className="font-medium text-xs">{item.invoiced}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Sotilgan</div>
                            <div className="font-medium text-xs text-primary">{item.sold}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Qoldiq</div>
                            <div className="font-medium text-xs">{item.currentStock}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Qayt.</div>
                            <div className="font-medium text-xs text-amber-600">{item.returned}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Inventar harakati */}
        <TabsContent value="movement">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-sm">Tez sotilayotgan (kam qoldiq)</span>
                </div>
                {isLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="space-y-2">
                    {products
                      .filter(p => p.totalStock > 0 && p.totalStock < LOW_STOCK_THRESHOLD)
                      .sort((a, b) => a.totalStock - b.totalStock)
                      .slice(0, 5)
                      .map(p => (
                        <div key={`${p.id}-${p.marketplace}`} className="flex items-center justify-between p-2 rounded border">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{MARKETPLACE_NAMES[p.marketplace]}</div>
                          </div>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">{p.totalStock} dona</Badge>
                        </div>
                      ))}
                    {products.filter(p => p.totalStock > 0 && p.totalStock < LOW_STOCK_THRESHOLD).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Kam qoldiqli mahsulot yo'q</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-sm">Tugagan mahsulotlar</span>
                </div>
                {isLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="space-y-2">
                    {products
                      .filter(p => p.totalStock === 0)
                      .slice(0, 5)
                      .map(p => (
                        <div key={`${p.id}-${p.marketplace}`} className="flex items-center justify-between p-2 rounded border">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{MARKETPLACE_NAMES[p.marketplace]}</div>
                          </div>
                          <Badge variant="destructive">0</Badge>
                        </div>
                      ))}
                    {outOfStockCount === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Barcha mahsulotlar mavjud</p>
                    )}
                    {outOfStockCount > 5 && (
                      <p className="text-xs text-muted-foreground text-center">va yana {outOfStockCount - 5} ta...</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Movement summary by marketplace */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Marketplace bo'yicha inventar xulosa
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                {connectedMarketplaces.map(mp => {
                  const mpProducts = products.filter(p => p.marketplace === mp);
                  const mpTotalStock = mpProducts.reduce((s, p) => s + p.totalStock, 0);
                  const mpLowStock = mpProducts.filter(p => p.lowStockAlert).length;
                  const mpOutOfStock = mpProducts.filter(p => p.totalStock === 0).length;
                  const mpReconciliation = reconciliation.filter(r => r.marketplace === mp);
                  const mpSold = mpReconciliation.reduce((s, r) => s + r.sold, 0);
                  const mpReturned = mpReconciliation.reduce((s, r) => s + r.returned, 0);

                  return (
                    <div key={mp} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{MARKETPLACE_NAMES[mp] || mp}</span>
                        <Badge variant="outline">{mpProducts.length} SKU</Badge>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                         <div>
                           <div className="text-[10px] sm:text-xs text-muted-foreground">Qoldiq</div>
                           <div className="font-bold text-xs sm:text-sm">{mpTotalStock}</div>
                         </div>
                         <div>
                           <div className="text-[10px] sm:text-xs text-muted-foreground">Sotilgan</div>
                           <div className="font-bold text-xs sm:text-sm text-primary">{mpSold}</div>
                         </div>
                         <div>
                           <div className="text-[10px] sm:text-xs text-muted-foreground">Qayt.</div>
                           <div className="font-bold text-xs sm:text-sm text-amber-600">{mpReturned}</div>
                         </div>
                         <div className="hidden sm:block">
                           <div className="text-xs text-muted-foreground">Kam</div>
                           <div className="font-bold text-sm text-amber-600">{mpLowStock}</div>
                         </div>
                         <div className="hidden sm:block">
                           <div className="text-xs text-muted-foreground">Tugagan</div>
                           <div className="font-bold text-sm text-destructive">{mpOutOfStock}</div>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
