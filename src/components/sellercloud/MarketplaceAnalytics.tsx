import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, DollarSign, Package, ShoppingCart } from 'lucide-react';

interface MarketplaceAnalyticsProps {
  connectedMarketplaces: string[];
}

export function MarketplaceAnalytics({ connectedMarketplaces }: MarketplaceAnalyticsProps) {
  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Analitika mavjud emas</h3>
          <p className="text-muted-foreground mb-4">
            Analitikani ko'rish uchun avval marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Jami daromad</span>
            </div>
            <div className="text-2xl font-bold">$0</div>
            <div className="text-xs text-green-500">+0% o'tgan oyga</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-sm">Buyurtmalar</span>
            </div>
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground">Bu oy</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" />
              <span className="text-sm">Mahsulotlar</span>
            </div>
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground">Faol</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Konversiya</span>
            </div>
            <div className="text-2xl font-bold">0%</div>
            <div className="text-xs text-muted-foreground">O'rtacha</div>
          </CardContent>
        </Card>
      </div>

      {/* Marketplace breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Marketplace bo'yicha statistika</CardTitle>
          <CardDescription>Har bir marketplace uchun alohida ko'rsatkichlar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {connectedMarketplaces.map((mp) => (
              <div key={mp} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {mp === 'yandex' ? '🟡' : mp === 'uzum' ? '🟣' : '📦'}
                  </div>
                  <div>
                    <div className="font-medium capitalize">{mp}</div>
                    <div className="text-sm text-muted-foreground">0 mahsulot</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">$0</div>
                  <div className="text-sm text-muted-foreground">0 buyurtma</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
