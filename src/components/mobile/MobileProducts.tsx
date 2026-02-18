import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Search, RefreshCw, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { VirtualProductList } from './VirtualProductList';

interface MobileProductsProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_EMOJI: Record<string, string> = {
  yandex: '🟡',
  uzum: '🟣',
  wildberries: '🔵',
  ozon: '🟢',
};

export function MobileProducts({ connectedMarketplaces, store }: MobileProductsProps) {
  const [selectedMp, setSelectedMp] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const isOnline = navigator.onLine;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMp) {
      setSelectedMp(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces, selectedMp]);

  const products = store.getProducts(selectedMp);
  const isLoading = store.isLoadingProducts;
  const isFetching = store.isFetching;
  const total = products.length;

  const handleRefresh = () => {
    if (!isOnline) {
      toast.error("Internet aloqasi yo'q");
      return;
    }
    toast.info('Yangilanmoqda...');
    store.refetchProducts(selectedMp);
  };

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return products;
    const searchLower = debouncedSearch.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(searchLower) ||
      p.offerId?.toLowerCase().includes(searchLower)
    );
  }, [products, debouncedSearch]);

  const productsWithKeys = useMemo(() =>
    filteredProducts.map((p, index) => ({
      ...p,
      uniqueKey: `${p.offerId}-${index}`,
    })),
    [filteredProducts]
  );

  if (connectedMarketplaces.length === 0) {
    return (
      <div className="p-4 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">Marketplace ulanmagan</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] bg-background z-30 px-3 py-3 border-b space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-lg">{productsWithKeys.length}</span>
            <span className="text-sm text-muted-foreground ml-1">mahsulot</span>
            {!isOnline && (
              <span className="text-xs text-amber-600 ml-2 inline-flex items-center gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading || isFetching} className="h-8 px-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
          {connectedMarketplaces.map(mp => (
            <Button key={mp} variant={selectedMp === mp ? 'default' : 'outline'} size="sm"
              onClick={() => setSelectedMp(mp)} className="shrink-0 text-xs h-8 px-3">
              {MARKETPLACE_EMOJI[mp]} {mp}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3 border rounded-lg">
              <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : productsWithKeys.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-50" />
          <p>Mahsulotlar topilmadi</p>
        </div>
      ) : (
        <VirtualProductList products={productsWithKeys} marketplace={selectedMp} />
      )}
    </div>
  );
}
