import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Filter, Plus, RefreshCw } from 'lucide-react';

interface MarketplaceProductsProps {
  connectedMarketplaces: string[];
}

export function MarketplaceProducts({ connectedMarketplaces }: MarketplaceProductsProps) {
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sinxronlash
          </Button>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Yangi mahsulot
        </Button>
      </div>

      {/* Products table placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Barcha mahsulotlar
          </CardTitle>
          <CardDescription>
            Ulangan marketplacedagi barcha mahsulotlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Mahsulotlar sinxronlanmoqda...</p>
            <p className="text-sm mt-2">Ulangan marketplace: {connectedMarketplaces.join(', ')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
