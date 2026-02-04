import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Package, Plus, RefreshCw, Loader2, Image, AlertCircle } from 'lucide-react';

interface MarketplaceProduct {
  offerId: string;
  name: string;
  price?: number;
  shopSku?: string;
  category?: string;
  pictures?: string[];
  availability?: string;
  stockFBO?: number;
  stockFBS?: number;
  stockCount?: number;
}

interface MarketplaceProductsProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex',
  uzum: 'Uzum',
  wildberries: 'WB',
  ozon: 'Ozon',
};

export function MarketplaceProducts({ connectedMarketplaces, fetchMarketplaceData }: MarketplaceProductsProps) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMarketplace) {
      setSelectedMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces, selectedMarketplace]);

  useEffect(() => {
    if (selectedMarketplace) {
      loadProducts();
    }
  }, [selectedMarketplace]);

  const loadProducts = async () => {
    if (!selectedMarketplace) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch ALL products with fetchAll flag
      const result = await fetchMarketplaceData(selectedMarketplace, 'products', { 
        limit: 200, 
        fetchAll: true 
      });
      
      if (result.success) {
        setProducts(result.data || []);
        setTotal(result.total || result.data?.length || 0);
      } else {
        setError(result.error || 'Mahsulotlarni yuklashda xatolik');
        setProducts([]);
      }
    } catch (err: any) {
      setError(err.message || 'Noma\'lum xatolik');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

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
    switch (status) {
      case 'ACTIVE':
      case 'PUBLISHED':
      case 'READY':
      case 'HAS_CARD_CAN_UPDATE':
      case 'HAS_CARD_NO_UPDATE':
        return <Badge variant="default" className="bg-green-500 whitespace-nowrap">Faol</Badge>;
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
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 whitespace-nowrap">Moderatsiya</Badge>;
      case 'ARCHIVED':
        return <Badge variant="secondary" className="whitespace-nowrap">Arxiv</Badge>;
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
            onClick={loadProducts}
            disabled={isLoading}
          >
            {isLoading ? (
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

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={loadProducts} className="ml-auto">
                Qayta urinish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

          {/* Results count */}
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
