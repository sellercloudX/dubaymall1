import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ArrowRight, Globe, Package, Search, Check, X, Loader2, Image, RefreshCw, Zap, Store, AlertTriangle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { checkBillingAccess, handleEdgeFunctionBillingError } from '@/lib/billingCheck';
import { backgroundTaskManager } from '@/lib/backgroundTaskManager';
import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
import { useAuth } from '@/contexts/AuthContext';
import { toDisplayUzs, formatUzs, isRubMarketplace, getRubToUzs } from '@/lib/currency';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { MARKETPLACE_CONFIG, MarketplaceLogo } from '@/lib/marketplaceConfig';

interface CardClonerProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface CloneableProduct {
  offerId: string;
  name: string;
  price: number;
  shopSku: string;
  pictures: string[];
  category: string;
  description: string;
  marketplace: string;
  selected: boolean;
}

const MARKETPLACE_INFO = MARKETPLACE_CONFIG;

export function CardCloner({ connectedMarketplaces, store }: CardClonerProps) {
  const { user } = useAuth();
  const { tasks } = useBackgroundTasks();

  const [sourceMarketplace, setSourceMarketplace] = useState(connectedMarketplaces[0] || '');
  const [targetMarketplaces, setTargetMarketplaces] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'not_cloned' | 'cloned'>('all');

  // Clone history from DB: Set of "sourceMarketplace:offerId:targetMarketplace"
  const [cloneHistoryKeys, setCloneHistoryKeys] = useState<Set<string>>(new Set());
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch clone history when source/target changes
  useEffect(() => {
    if (!user || targetMarketplaces.length === 0) {
      setCloneHistoryKeys(new Set());
      return;
    }
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data } = await supabase
          .from('clone_history')
          .select('source_marketplace, source_offer_id, target_marketplace')
          .eq('user_id', user.id)
          .eq('source_marketplace', sourceMarketplace)
          .in('target_marketplace', targetMarketplaces);
        
        const keys = new Set<string>();
        (data || []).forEach(row => {
          keys.add(`${row.source_marketplace}:${row.source_offer_id}:${row.target_marketplace}`);
        });
        setCloneHistoryKeys(keys);
      } catch (err) {
        console.error('Clone history fetch error:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [user, sourceMarketplace, targetMarketplaces]);

  // Track active clone task from background manager
  const activeCloneTask = tasks.find(t => t.type === 'clone' && (t.status === 'running' || t.status === 'pending'));
  const completedCloneTask = tasks.find(t => t.type === 'clone' && (t.status === 'completed' || t.status === 'failed'));
  const isCloning = !!activeCloneTask;
  const cloneProgress = activeCloneTask?.progress || 0;

  const isLoading = store.isLoadingProducts;

  useEffect(() => {
    setSelectedIds(new Set());
    setTargetMarketplaces([]);
    setFilterTab('all');
  }, [sourceMarketplace]);

  // Set default source when marketplaces change
  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !connectedMarketplaces.includes(sourceMarketplace)) {
      setSourceMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces]);

  // Get products for selected source
  const products = useMemo((): CloneableProduct[] => {
    if (!sourceMarketplace) return [];
    // Filter out deleted/archived/inactive products from Yandex and other marketplaces
    const INACTIVE_STATUSES = ['INACTIVE', 'ARCHIVED', 'DELISTED', 'DELETED', 'DISABLED', 'REMOVED', 'NO_STOCKS', 'UNPUBLISHED'];
    return store.getProducts(sourceMarketplace)
      .filter(p => {
        const status = (p.availability || '').toUpperCase();
        return !INACTIVE_STATUSES.includes(status);
      })
      .map(p => ({
        offerId: p.offerId,
        name: p.name || 'Nomsiz',
        price: p.price || 0,
        shopSku: p.shopSku || p.offerId,
        pictures: p.pictures || [],
        category: p.category || '',
        description: p.description || '',
        marketplace: sourceMarketplace,
        selected: selectedIds.has(p.offerId),
      }));
  }, [sourceMarketplace, store.dataVersion, selectedIds]);

  const getProductCount = useCallback((mp: string) => {
    return store.getProducts(mp).length;
  }, [store.dataVersion]);

  const availableTargets = connectedMarketplaces.filter(mp => mp !== sourceMarketplace);

  const toggleTarget = (mp: string) => {
    setTargetMarketplaces(prev => prev.includes(mp) ? prev.filter(m => m !== mp) : [...prev, mp]);
  };

  const toggleProduct = (offerId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.shopSku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectAll = () => {
    // Use tab-filtered products so "Select All" works on visible items only
    const visibleProducts = filteredByTab;
    const allSelected = visibleProducts.every(p => selectedIds.has(p.offerId));
    const newIds = new Set(selectedIds);
    visibleProducts.forEach(p => {
      if (allSelected) newIds.delete(p.offerId);
      else newIds.add(p.offerId);
    });
    setSelectedIds(newIds);
  };

  const selectedProducts = products.filter(p => selectedIds.has(p.offerId));

  // Normalize text for fuzzy comparison
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '').trim();
  
  // Check if product already exists in target marketplace — ONLY use DB clone history
  // Do NOT compare SKU/offerId across marketplaces — different marketplaces have independent product IDs
  const isAlreadyCloned = useCallback((product: CloneableProduct, targetMp: string): boolean => {
    const historyKey = `${sourceMarketplace}:${product.offerId}:${targetMp}`;
    return cloneHistoryKeys.has(historyKey);
  }, [cloneHistoryKeys, sourceMarketplace]);

  // Get cloned status for each product across all selected targets
  const clonedStatusMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (targetMarketplaces.length === 0) return map;
    for (const product of products) {
      const clonedTo: string[] = [];
      for (const target of targetMarketplaces) {
        if (isAlreadyCloned(product, target)) {
          clonedTo.push(MARKETPLACE_INFO[target]?.name || target);
        }
      }
      if (clonedTo.length > 0) map.set(product.offerId, clonedTo);
    }
    return map;
  }, [products, targetMarketplaces, isAlreadyCloned]);

  // Filtered products by clone status
  const clonedCount = useMemo(() => {
    if (targetMarketplaces.length === 0) return 0;
    return products.filter(p => {
      // "Cloned" = cloned to ALL selected targets
      return targetMarketplaces.every(t => isAlreadyCloned(p, t));
    }).length;
  }, [products, targetMarketplaces, isAlreadyCloned]);

  const notClonedCount = products.length - clonedCount;

  const filteredByTab = useMemo(() => {
    if (targetMarketplaces.length === 0 || filterTab === 'all') return filteredProducts;
    return filteredProducts.filter(p => {
      const isFullyCloned = targetMarketplaces.every(t => isAlreadyCloned(p, t));
      return filterTab === 'cloned' ? isFullyCloned : !isFullyCloned;
    });
  }, [filteredProducts, filterTab, targetMarketplaces, isAlreadyCloned]);

  // Clone product to external marketplace
  const cloneToMarketplace = async (product: CloneableProduct, targetMp: string): Promise<boolean> => {
    try {
      const validImages = (product.pictures || []).filter(p => p && p.startsWith('http'));
      const convertedPrice = convertPrice(product.price, product.marketplace, targetMp);
      const costPrice = Math.round(convertedPrice * 0.6);
      const productDescription = product.description || product.name;
      const productCategory = product.category || '';
      
      
      if (targetMp === 'yandex') {
        // Get full product data from store for richer context
        const storeProducts = store.getProducts(product.marketplace);
        const fullProduct = storeProducts.find(p => p.offerId === product.offerId);
        
        const { data, error } = await supabase.functions.invoke('yandex-market-create-card', {
          body: {
            shopId: 'sellercloud',
            product: {
              name: product.name,
              description: productDescription,
              price: convertedPrice,
              costPrice,
              images: validImages,
              category: productCategory,
              sourceMarketplace: product.marketplace,
              sourceCategory: productCategory,
              sourceCategoryId: fullProduct?.marketCategoryId,
              shopSku: product.shopSku,
            },
            pricing: {
              costPrice,
              marketplaceCommission: Math.round(convertedPrice * 0.15),
              logisticsCost: 3000,
              taxRate: 4,
              targetProfit: Math.round(convertedPrice * 0.2),
              recommendedPrice: convertedPrice,
              netProfit: Math.round(convertedPrice * 0.2),
            },
            skipImageGeneration: true, // Always reuse source images in clone mode
            cloneMode: true,
          },
        });
        
        if (error) {
          console.error(`Yandex clone error for "${product.name}":`, error);
          if (handleEdgeFunctionBillingError(error, data)) throw new Error('billing_error');
          const errorBody = data || error?.context || {};
          toast.error(`${product.name.slice(0, 30)}: ${errorBody?.error || error.message || 'Xatolik'}`);
          return false;
        }
        if (!data?.success) {
          // Show detailed Yandex API errors
          const apiErrors = data?.results?.[0]?.error || data?.results?.[0]?.yandexResponse?.errors?.[0]?.message || data?.error || 'API xatosi';
          console.error(`Yandex API error for "${product.name}":`, JSON.stringify(data?.results?.[0]?.yandexResponse || data));
          toast.error(`${product.name.slice(0, 30)}: ${typeof apiErrors === 'string' ? apiErrors.slice(0, 100) : 'API xatosi'}`);
          return false;
        }
        return true;
      }

      if (targetMp === 'wildberries') {
        // WB card creation involves nmID polling (~2-3 min), need extended timeout
        const { data, error } = await supabase.functions.invoke('wildberries-create-card', {
          body: {
            shopId: 'sellercloud',
            product: {
              name: product.name,
              description: productDescription,
              price: convertedPrice,
              costPrice,
              images: validImages,
              category: productCategory,
              shopSku: product.shopSku, // Preserve original SKU
            },
            skipImageGeneration: validImages.length >= 4,
            cloneMode: true,
          },
        });
        
        if (error) {
          console.error(`WB clone error for "${product.name}":`, error);
          if (handleEdgeFunctionBillingError(error, data)) throw new Error('billing_error');
          const errorBody = data || error?.context || {};
          toast.error(`${product.name.slice(0, 30)}: ${errorBody?.error || error.message || 'Xatolik'}`);
          return false;
        }
        if (!data?.success) {
          const apiErr = data?.results?.[0]?.error || data?.error || 'API xatosi';
          console.error(`WB API error for "${product.name}":`, JSON.stringify(data));
          toast.error(`${product.name.slice(0, 30)}: ${typeof apiErr === 'string' ? apiErr.slice(0, 100) : 'API xatosi'}`);
          return false;
        }
        return true;
      }
      
      if (targetMp === 'uzum') {
        const { data, error } = await supabase.functions.invoke('create-uzum-card', {
          body: {
            product: {
              name: product.name,
              description: productDescription,
              price: convertedPrice,
              costPrice: costPrice,
              images: validImages,
              category: productCategory,
              shopSku: product.shopSku, // Preserve original SKU
            },
            cloneMode: true,
          },
        });
        
        if (error) {
          console.error(`Uzum clone error for "${product.name}":`, error);
          if (handleEdgeFunctionBillingError(error, data)) throw new Error('billing_error');
          const errorBody = data || error?.context || {};
          toast.error(`${product.name.slice(0, 30)}: ${errorBody?.error || error.message || 'Xatolik'}`);
          return false;
        }
        if (!data?.success) {
          console.error(`Uzum API error for "${product.name}":`, JSON.stringify(data));
          toast.error(`${product.name.slice(0, 30)}: ${data?.error || 'API xatosi'}`);
          return false;
        }
        if (data.method === 'prepared') {
          toast.info(`${product.name.slice(0, 25)}: Ma'lumotlar tayyor (qo'lda yuklash kerak)`);
        }
        return true;
      }
      
      console.warn(`⚠️ ${targetMp} API does not support card creation`);
      toast.error(`${MARKETPLACE_INFO[targetMp]?.name || targetMp}: Kartochka yaratish qo'llab-quvvatlanmaydi`);
      return false;
    } catch (err: any) {
      if (err?.message === 'billing_error') {
        throw err; // Re-throw to stop batch processing
      }
      console.error(`Clone to ${targetMp} failed:`, err?.message || err);
      return false;
    }
  };

  const handleClone = async () => {
    if (selectedProducts.length === 0 || targetMarketplaces.length === 0) {
      return;
    }

    // Pre-flight billing check — prevent 402 errors before starting
    const featureKey = targetMarketplaces.includes('yandex') ? 'clone-to-yandex' 
      : targetMarketplaces.includes('wildberries') ? 'clone-to-wildberries' 
      : 'clone-to-uzum';
    if (!(await checkBillingAccess(featureKey, user?.id))) return;

    // Build all clone tasks
    const cloneTasks: { product: CloneableProduct; target: string }[] = [];
    let skipped = 0;
    for (const product of selectedProducts) {
      for (const target of targetMarketplaces) {
        const alreadyCloned = isAlreadyCloned(product, target);
        
        if (alreadyCloned) {
          skipped++;
        } else {
          cloneTasks.push({ product, target });
        }
      }
    }

    const total = cloneTasks.length + skipped;
    
    if (cloneTasks.length === 0) {
      toast.info(`Barcha ${skipped} ta mahsulot allaqachon mavjud`);
      return;
    }

    // Create background task
    const taskId = backgroundTaskManager.createTask(
      'clone',
      `Klonlanmoqda: 0/${cloneTasks.length}`,
      { skipped },
      cloneTasks.length
    );

    // Start running asynchronously (fire-and-forget)
    (async () => {
      backgroundTaskManager.updateTask(taskId, { status: 'running' });
      let success = 0;
      let failed = 0;
      const BATCH_SIZE = 3;

      for (let i = 0; i < cloneTasks.length; i += BATCH_SIZE) {
        // Check if cancelled
        const currentTask = backgroundTaskManager.getTask(taskId);
        if (currentTask?.status === 'cancelled') break;

        const batch = cloneTasks.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(({ product, target }) => cloneToMarketplace(product, target).then(ok => ({ ok, product, target })))
        );
        // Check if any result is a billing error — stop all processing
        const billingError = results.find(r => r.status === 'rejected' && r.reason?.message === 'billing_error');
        if (billingError) {
          backgroundTaskManager.updateTask(taskId, {
            status: 'failed',
            message: 'Balans yetarli emas. Balansni to\'ldiring.',
          });
          return; // Stop batch processing entirely
        }

        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.ok) {
            success++;
            backgroundTaskManager.incrementCompleted(taskId);
            // Save to clone_history
            if (user) {
              supabase.from('clone_history').upsert({
                user_id: user.id,
                source_marketplace: r.value.product.marketplace,
                source_offer_id: r.value.product.offerId,
                target_marketplace: r.value.target,
              }, { onConflict: 'user_id,source_marketplace,source_offer_id,target_marketplace' }).then(() => {});
            }
          } else {
            failed++;
            backgroundTaskManager.incrementFailed(taskId);
          }
        }
        backgroundTaskManager.updateTask(taskId, {
          message: `Klonlanmoqda: ${success + failed}/${cloneTasks.length}`,
          currentItem: batch[batch.length - 1]?.product.name,
        });
      }

      // Final update
      const finalMsg = `✅ ${success} ta muvaffaqiyatli${failed > 0 ? `, ❌ ${failed} ta xato` : ''}${skipped > 0 ? `, ⏭ ${skipped} ta o'tkazildi` : ''}`;
      backgroundTaskManager.updateTask(taskId, {
        status: failed > 0 && success === 0 ? 'failed' : 'completed',
        message: finalMsg,
        progress: 100,
        data: { success, failed, skipped },
      });
    })();

    // Clear selection after starting
    setSelectedIds(new Set());
  };

  const formatPrice = (price: number, marketplace?: string) => {
    const mp = marketplace || sourceMarketplace;
    const priceUzs = toDisplayUzs(price, mp);
    return formatUzs(priceUzs) + " so'm";
  };

  // Convert price between marketplaces using dynamic exchange rate
  const convertPrice = (price: number, fromMp: string, toMp: string): number => {
    const fromRub = isRubMarketplace(fromMp);
    const toRub = isRubMarketplace(toMp);
    const rubToUzs = getRubToUzs();
    if (fromRub && !toRub) return Math.round(price * rubToUzs); // RUB → UZS
    if (!fromRub && toRub) return Math.round(price / rubToUzs); // UZS → RUB
    return price; // same currency
  };

  const skippedCount = useMemo(() => {
    if (targetMarketplaces.length === 0) return 0;
    let count = 0;
    for (const product of selectedProducts) {
      for (const target of targetMarketplaces) {
        if (isAlreadyCloned(product, target)) count++;
      }
    }
    return count;
  }, [selectedProducts, targetMarketplaces, isAlreadyCloned]);

  const actualCloneCount = (selectedProducts.length * targetMarketplaces.length) - skippedCount;

  if (connectedMarketplaces.length < 2) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Copy className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Kartochka klonlash</h3>
        <p className="text-muted-foreground mb-4">Klonlash uchun kamida 2 ta marketplace ulang</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden pb-20">
      {/* Source/Target Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Manba</CardTitle>
            <CardDescription className="text-xs">Qayerdan klonlash?</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-2">
              {connectedMarketplaces.map(mp => {
                const info = MARKETPLACE_INFO[mp] || { name: mp, logo: '📦', color: 'from-gray-500 to-gray-600' };
                const count = getProductCount(mp);
                return (
                  <button key={mp} onClick={() => setSourceMarketplace(mp)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${sourceMarketplace === mp ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
                    <MarketplaceLogo marketplace={mp} size={24} className="shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="font-medium text-sm truncate">{info.name}</div>
                      <div className="text-xs text-muted-foreground">{count} mahsulot</div>
                    </div>
                    {sourceMarketplace === mp && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Maqsad</CardTitle>
            <CardDescription className="text-xs">Qayerga klonlash? (bir nechtasini tanlash mumkin)</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-2">
              {availableTargets.length === 0
                ? <p className="text-xs text-muted-foreground">Boshqa marketplace yo'q</p>
                : availableTargets.map(mp => {
                  const info = MARKETPLACE_INFO[mp] || { name: mp, logo: '📦', color: 'from-gray-500 to-gray-600' };
                  const isSelected = targetMarketplaces.includes(mp);
                  return (
                    <button key={mp} onClick={() => toggleTarget(mp)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
                      <MarketplaceLogo marketplace={mp} size={24} className="shrink-0" />
                      <div className="text-left min-w-0">
                        <div className="font-medium text-sm truncate">{info.name}</div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Selection */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Package className="h-4 w-4 shrink-0" />
                <span className="truncate">Mahsulotlar</span>
              </CardTitle>
              <CardDescription className="text-xs">{selectedIds.size} / {products.length} tanlandi</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Qidirish..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm w-full sm:w-36" />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll} className="shrink-0 text-xs h-8">
                {filteredByTab.length > 0 && filteredByTab.every(p => selectedIds.has(p.offerId)) ? 'Bekor' : 'Barchasi'}
              </Button>
            </div>
          </div>

          {/* Filter tabs - only show when targets selected */}
          {targetMarketplaces.length > 0 && (
            <div className="mt-3">
              <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)}>
                <TabsList className="h-8 w-full grid grid-cols-3">
                  <TabsTrigger value="all" className="text-xs h-7">
                    Jami ({products.length})
                  </TabsTrigger>
                  <TabsTrigger value="not_cloned" className="text-xs h-7">
                    Klonlanmagan ({notClonedCount})
                  </TabsTrigger>
                  <TabsTrigger value="cloned" className="text-xs h-7">
                    Klonlangan ({clonedCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading || historyLoading ? (
            <div className="space-y-2 p-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredByTab.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{filterTab === 'not_cloned' ? 'Barcha mahsulotlar klonlangan ✓' : filterTab === 'cloned' ? 'Hali klonlanmagan' : 'Topilmadi'}</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto px-3 pb-3">
              {filteredByTab.map(product => (
                <div key={product.offerId}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(product.offerId) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted'}`}
                  onClick={() => toggleProduct(product.offerId)}>
                  <Checkbox checked={selectedIds.has(product.offerId)} className="shrink-0" />
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {product.pictures.length > 0
                      ? <img src={product.pictures[0]} alt="" className="w-full h-full object-cover" />
                      : <Image className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{product.name}</div>
                    <div className="flex items-center gap-1">
                      <code className="text-[10px] text-muted-foreground truncate">{product.shopSku}</code>
                      {clonedStatusMap.has(product.offerId) && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-accent/50 text-accent-foreground border-accent shrink-0">
                          ✓ {clonedStatusMap.get(product.offerId)!.join(', ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="font-medium text-xs whitespace-nowrap shrink-0">{formatPrice(product.price, product.marketplace)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deduplication warning */}
      {skippedCount > 0 && !isCloning && !completedCloneTask && (
        <Card className="border-warning/30 bg-warning/5 overflow-hidden">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{skippedCount}</span> ta mahsulot allaqachon maqsad marketplace(lar)da mavjud — ular o'tkazib yuboriladi.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Clone Action */}
      {isCloning ? (
        <Card className="overflow-hidden">
          <CardContent className="py-6">
            <div className="text-center mb-3">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm">{activeCloneTask?.message || `Klonlanmoqda... ${cloneProgress}%`}</p>
              {activeCloneTask?.currentItem && (
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs mx-auto">
                  {activeCloneTask.currentItem}
                </p>
              )}
            </div>
            <Progress value={cloneProgress} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{activeCloneTask?.completedItems || 0} / {activeCloneTask?.totalItems || 0}</span>
              <span>{cloneProgress}%</span>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">
              💡 Boshqa sahifaga o'tishingiz mumkin — jarayon fonida davom etadi
            </p>
          </CardContent>
        </Card>
      ) : completedCloneTask ? (
        <Card className="overflow-hidden">
          <CardContent className="py-6">
            <div className="text-center space-y-3">
              {completedCloneTask.status === 'completed' ? (
                <Check className="h-8 w-8 mx-auto text-primary" />
              ) : (
                <X className="h-8 w-8 mx-auto text-destructive" />
              )}
              <h3 className="font-semibold">Klonlash yakunlandi</h3>
              <div className="flex justify-center gap-3 text-sm flex-wrap">
                {(completedCloneTask.data?.success > 0) && (
                  <Badge variant="default">{completedCloneTask.data.success} ta muvaffaqiyatli klonlandi</Badge>
                )}
                {(completedCloneTask.data?.skipped > 0) && (
                  <Badge variant="outline">{completedCloneTask.data.skipped} ta o'tkazildi</Badge>
                )}
                {(completedCloneTask.data?.failed > 0) && (
                  <Badge variant="destructive">{completedCloneTask.data.failed} ta klonlanmadi</Badge>
                )}
                {(completedCloneTask.failedItems || 0) > 0 && !completedCloneTask.data?.failed && (
                  <Badge variant="destructive">{completedCloneTask.failedItems} ta xato</Badge>
                )}
              </div>
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => backgroundTaskManager.removeTask(completedCloneTask.id)}
              >
                OK — Yangi klonlash
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full"
          size="lg"
          disabled={selectedProducts.length === 0 || targetMarketplaces.length === 0 || actualCloneCount === 0}
          onClick={handleClone}
        >
          <Copy className="h-4 w-4 mr-2" />
          {actualCloneCount > 0
            ? `${actualCloneCount} ta mahsulotni klonlash`
            : 'Mahsulot va maqsad tanlang'}
          {targetMarketplaces.length > 0 && (
            <span className="ml-2 text-xs opacity-75">→ {targetMarketplaces.map(mp => MARKETPLACE_INFO[mp]?.name || mp).join(', ')}</span>
          )}
        </Button>
      )}
    </div>
  );
}
