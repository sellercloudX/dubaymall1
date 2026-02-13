import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Package, Plus, RefreshCw, Loader2, Image, AlertCircle } from 'lucide-react';
import type { MarketplaceDataStore, MarketplaceProduct } from '@/hooks/useMarketplaceDataStore';

interface MarketplaceProductsProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex',
  uzum: 'Uzum',
  wildberries: 'WB',
  ozon: 'Ozon',
};

export function MarketplaceProducts({ connectedMarketplaces, store }: MarketplaceProductsProps) {
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMarketplace) {
      setSelectedMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces, selectedMarketplace]);

  const products = store.getProducts(selectedMarketplace);
  const isLoading = store.isLoadingProducts;
  const total = products.length;

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.offerId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.shopSku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price?: number) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const getAvailabilityBadge = (availability?: string) => {
    const status = availability?.toUpperCase();
    const statusLower = availability?.toLowerCase() || '';
    
    // Uzum statuses (Uzbek and English)
    if (statusLower === 'sotuvda' || status === 'IN_STOCK') 
      return <Badge variant="default" className="whitespace-nowrap bg-green-600">Sotuvda</Badge>;
    if (statusLower === 'tugadi' || status === 'OUT_OF_STOCK' || status === 'RUN_OUT') 
      return <Badge variant="destructive" className="whitespace-nowrap">Tugadi</Badge>;
    if (statusLower === 'arxiv' || statusLower === 'arxivlangan' || status === 'ARCHIVED') 
      return <Badge variant="secondary" className="whitespace-nowrap">Arxiv</Badge>;
    if (statusLower === 'yetkazishga tayyor' || status === 'READY_TO_SHIP' || status === 'READY_TO_SEND') 
      return <Badge variant="default" className="whitespace-nowrap">Yetkazishga tayyor</Badge>;
    if (statusLower === 'moderatsiyada' || status === 'ON_PREMODERATION' || status === 'ON_MODERATION') 
      return <Badge variant="outline" className="bg-accent text-accent-foreground whitespace-nowrap">Moderatsiya</Badge>;
    if (statusLower === 'bloklangan' || status === 'BLOCKED') 
      return <Badge variant="destructive" className="whitespace-nowrap">Bloklangan</Badge>;
    
    // Yandex statuses
    switch (status) {
      case 'ACTIVE':
      case 'PUBLISHED':
      case 'READY':
      case 'HAS_CARD_CAN_UPDATE':
      case 'HAS_CARD_NO_UPDATE':
        return <Badge variant="default" className="whitespace-nowrap">Faol</Badge>;
      case 'INACTIVE':
      case 'UNPUBLISHED':
      case 'DISABLED_BY_PARTNER':
        return <Badge variant="secondary" className="whitespace-nowrap">Nofaol</Badge>;
      case 'DELISTED':
      case 'REJECTED':
      case 'DISABLED_AUTOMATICALLY':
        return <Badge variant="destructive" className="whitespace-nowrap">O'chirilgan</Badge>;
      case 'MODERATION':
      case 'PROCESSING':
      case 'CREATING_CARD':
      case 'NO_CARD':
        return <Badge variant="outline" className="bg-accent text-accent-foreground whitespace-nowrap">Moderatsiya</Badge>;
      default:
        return <Badge variant="outline" className="whitespace-nowrap">{availability || 'Noma\'lum'}</Badge>;
    }
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Mahsulotlar yo'q</h3>
          <p className="text-muted-foreground mb-4">
            Mahsulotlarni ko'rish uchun avval marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          {connectedMarketplaces.map((mp) => (
            <Button
              key={mp}
              variant={selectedMarketplace === mp ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarketplace(mp)}
            >
              {mp === 'yandex' ? '🟡 Yandex' : mp === 'uzum' ? '🟣 Uzum' : mp}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => store.refetchProducts(selectedMarketplace)}
            disabled={store.isFetching}
          >
            {store.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Yangi
          </Button>
        </div>
      </div>

      {/* Products table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mahsulotlar
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">{total} ta</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {MARKETPLACE_NAMES[selectedMarketplace] || selectedMarketplace} dagi mahsulotlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Mahsulotlar topilmadi</p>
              {searchQuery && (
                <p className="text-sm mt-1">"{searchQuery}" bo'yicha natija yo'q</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Rasm</TableHead>
                    <TableHead className="min-w-[200px]">Mahsulot</TableHead>
                    <TableHead className="w-32">SKU</TableHead>
                    <TableHead className="w-36 text-right">Narxi</TableHead>
                    <TableHead className="w-24 text-center">FBO</TableHead>
                    <TableHead className="w-24 text-center">FBS</TableHead>
                    <TableHead className="w-28 text-center">Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.offerId}>
                      <TableCell className="p-2">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                          {product.pictures && product.pictures.length > 0 ? (
                            <img 
                              src={product.pictures[0]} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`flex items-center justify-center ${product.pictures?.length ? 'hidden' : ''}`}>
                            <Image className="h-6 w-6 text-muted-foreground" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium line-clamp-2">{product.name || 'Nomsiz'}</div>
                          <div className="text-xs text-muted-foreground mt-1">{product.offerId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded block truncate max-w-[100px]">
                          {product.shopSku || '—'}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatPrice(product.price)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={(product.stockFBO || 0) > 0 ? 'outline' : 'secondary'} className="whitespace-nowrap">
                          {product.stockFBO || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={(product.stockFBS || 0) > 0 ? 'default' : 'destructive'} className="whitespace-nowrap">
                          {product.stockFBS || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getAvailabilityBadge(product.availability)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && filteredProducts.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Ko'rsatilmoqda: {filteredProducts.length} / {total} mahsulot
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
