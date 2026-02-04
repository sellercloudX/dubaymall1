import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Filter, RefreshCw } from 'lucide-react';

interface MarketplaceOrdersProps {
  connectedMarketplaces: string[];
}

export function MarketplaceOrders({ connectedMarketplaces }: MarketplaceOrdersProps) {
  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Buyurtmalar yo'q</h3>
          <p className="text-muted-foreground mb-4">
            Buyurtmalarni ko'rish uchun avval marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Yangilash
        </Button>
      </div>

      {/* Orders placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Barcha buyurtmalar
          </CardTitle>
          <CardDescription>
            Ulangan marketplacedagi barcha buyurtmalar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Buyurtmalar sinxronlanmoqda...</p>
            <p className="text-sm mt-2">Ulangan marketplace: {connectedMarketplaces.join(', ')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
