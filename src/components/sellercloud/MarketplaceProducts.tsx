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
import { Package, Filter, Plus, RefreshCw, Loader2, Image, AlertCircle } from 'lucide-react';

interface MarketplaceProduct {
  offerId: string;
  name: string;
  price?: number;
  shopSku?: string;
  category?: string;
  pictures?: string[];
  availability?: string;
  stockCount?: number;
}

interface MarketplaceProductsProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

export function MarketplaceProducts({ connectedMarketplaces, fetchMarketplaceData }: MarketplaceProductsProps) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMarketplace) {
      setSelectedMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces, selectedMarketplace]);

  useEffect(() => {
    if (selectedMarketplace) {
      loadProducts();
    }
  }, [selectedMarketplace, page]);

  const loadProducts = async () => {
    if (!selectedMarketplace) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchMarketplaceData(selectedMarketplace, 'products', { 
        limit: 50, 
        page 
      });
      
      if (result.success) {
        setProducts(result.data || []);
        setTotal(result.total || 0);
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
    return new Intl.NumberFormat('uz-UZ', { 
      style: 'decimal',
      minimumFractionDigits: 0 
    }).format(price) + ' so\'m';
  };

  const getAvailabilityBadge = (availability?: string) => {
    const status = availability?.toUpperCase();
    switch (status) {
      case 'ACTIVE':
      case 'PUBLISHED':
      case 'READY':
      case 'HAS_CARD_CAN_UPDATE':
      case 'HAS_CARD_NO_UPDATE':
        return <Badge variant="default" className="bg-green-500">Faol</Badge>;
      case 'INACTIVE':
      case 'UNPUBLISHED':
      case 'DISABLED_BY_PARTNER':
        return <Badge variant="secondary">Nofaol</Badge>;
      case 'DELISTED':
      case 'REJECTED':
      case 'DISABLED_AUTOMATICALLY':
        return <Badge variant="destructive">O'chirilgan</Badge>;
      case 'MODERATION':
      case 'PROCESSING':
      case 'CREATING_CARD':
      case 'NO_CARD':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Moderatsiyada</Badge>;
      case 'ARCHIVED':
        return <Badge variant="secondary">Arxivlangan</Badge>;
      default:
        return <Badge variant="outline">{availability || 'Noma\'lum'}</Badge>;
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
          {/* Marketplace tabs */}
          {connectedMarketplaces.map((mp) => (
            <Button
              key={mp}
              variant={selectedMarketplace === mp ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedMarketplace(mp);
                setPage(1);
              }}
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
            Yangi mahsulot
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mahsulotlar
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">{total} ta</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {selectedMarketplace === 'yandex' ? 'Yandex Market' : selectedMarketplace} dagi mahsulotlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Mahsulot</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Narxi</TableHead>
                    <TableHead>Zaxira</TableHead>
                    <TableHead>Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.offerId}>
                      <TableCell>
                        {product.pictures && product.pictures.length > 0 ? (
                          <img 
                            src={product.pictures[0]} 
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 bg-muted rounded flex items-center justify-center ${product.pictures?.length ? 'hidden' : ''}`}>
                          <Image className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium line-clamp-1">{product.name || 'Nomsiz'}</div>
                          <div className="text-xs text-muted-foreground">{product.offerId}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.shopSku || '—'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(product.price)}
                      </TableCell>
                      <TableCell>
                        {product.stockCount !== undefined ? (
                          <Badge variant={product.stockCount > 0 ? 'outline' : 'destructive'}>
                            {product.stockCount} dona
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {getAvailabilityBadge(product.availability)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {((page - 1) * 50) + 1} - {Math.min(page * 50, total)} / {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || isLoading}
                  onClick={() => setPage(p => p - 1)}
                >
                  Oldingi
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 50 >= total || isLoading}
                  onClick={() => setPage(p => p + 1)}
                >
                  Keyingi
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
