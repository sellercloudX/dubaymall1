 import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
 import { Package, Search, RefreshCw, Image as ImageIcon, WifiOff } from 'lucide-react';
 import { toast } from 'sonner';
 import { useMarketplaceProducts, useInvalidateMarketplaceData } from '@/hooks/useMarketplaceData';

 interface MobileProductsProps {
   connectedMarketplaces: string[];
 }

const MARKETPLACE_EMOJI: Record<string, string> = {
  yandex: '🟡',
  uzum: '🟣',
  wildberries: '🔵',
  ozon: '🟢',
};

 export function MobileProducts({ connectedMarketplaces }: MobileProductsProps) {
  const [selectedMp, setSelectedMp] = useState('');
  const [search, setSearch] = useState('');
 
   // TanStack Query hooks - proper caching & offline support
   const { 
     data: productsData, 
     isLoading, 
     isFetching,
     dataUpdatedAt,
     isStale,
   } = useMarketplaceProducts(selectedMp || null);
   
   const { invalidateProducts } = useInvalidateMarketplaceData();
   const isOnline = navigator.onLine;

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMp) {
      setSelectedMp(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces]);

   const products = productsData?.data || [];
   const total = productsData?.total || 0;
   const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const handleRefresh = () => {
     if (!isOnline) {
       toast.error('Internet aloqasi yo\'q');
       return;
     }
    toast.info('Yangilanmoqda...');
     invalidateProducts(selectedMp);
  };

   // Filter products with memoization
   const filteredProducts = useMemo(() => {
     const searchLower = search.toLowerCase();
     return products.filter(p =>
       p.name?.toLowerCase().includes(searchLower) ||
       p.offerId?.toLowerCase().includes(searchLower)
     );
   }, [products, search]);
 
   // Create unique keys for products (handle duplicates)
   const productsWithKeys = useMemo(() => 
     filteredProducts.map((p, index) => ({
       ...p,
       uniqueKey: `${p.offerId}-${index}`,
     })),
     [filteredProducts]
  );

  const formatPrice = (price?: number) => {
    if (!price) return '—';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const getStockBadge = (fbo?: number, fbs?: number) => {
    const total = (fbo || 0) + (fbs || 0);
    if (total === 0) return <Badge variant="destructive" className="text-[10px]">Tugagan</Badge>;
    if (total < 10) return <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">{total} ta</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{total} ta</Badge>;
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <div className="p-4 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">Marketplace ulanmagan</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-14 bg-background z-30 px-3 py-3 border-b space-y-2.5">
        {/* Top row with title and refresh */}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-sm">{total} ta mahsulot</span>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground ml-2">
                • {lastUpdated.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
             {!isOnline && (
               <span className="text-xs text-yellow-600 ml-2 flex items-center gap-1">
                 <WifiOff className="h-3 w-3" /> Offline
               </span>
             )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
             disabled={isLoading || isFetching}
            className="h-8 px-2"
          >
             <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
 
        {/* Marketplace Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
          {connectedMarketplaces.map(mp => (
            <Button
              key={mp}
              variant={selectedMp === mp ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMp(mp)}
              className="shrink-0 text-xs h-8 px-3"
            >
              {MARKETPLACE_EMOJI[mp]} {mp}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex gap-3">
                <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))
         ) : productsWithKeys.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Mahsulotlar topilmadi</p>
          </div>
        ) : (
           productsWithKeys.map((product) => (
             <Card key={product.uniqueKey} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex">
                  {/* Product Image */}
                  <div className="w-16 h-16 bg-muted flex items-center justify-center shrink-0">
                    {product.pictures?.[0] ? (
                      <img 
                        src={product.pictures[0]} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 p-2.5 min-w-0">
                    <div className="font-medium text-xs line-clamp-2 mb-1 leading-snug">
                      {product.name || 'Nomsiz'}
                    </div>
                    <div className="text-[10px] text-muted-foreground mb-1.5 truncate">
                      SKU: {product.shopSku || product.offerId}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-primary text-xs truncate">
                        {formatPrice(product.price)}
                      </span>
                      {getStockBadge(product.stockFBO, product.stockFBS)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
