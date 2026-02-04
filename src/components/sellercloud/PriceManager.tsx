import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, TrendingUp, TrendingDown, BarChart3, 
  Percent, Calculator, Eye, RefreshCw, AlertCircle
} from 'lucide-react';

interface PriceManagerProps {
  connectedMarketplaces: string[];
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
};

interface ProductPrice {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  prices: Record<string, number>;
  competitorPrices: Record<string, number>;
  recommendedPrice: number;
  profit: number;
  profitPercent: number;
}

// Mock data
const MOCK_PRICES: ProductPrice[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max 256GB',
    sku: 'IPH15PM-256',
    costPrice: 1200,
    prices: { yandex: 1499, uzum: 1450 },
    competitorPrices: { yandex: 1480, uzum: 1420 },
    recommendedPrice: 1460,
    profit: 260,
    profitPercent: 21.7,
  },
  {
    id: '2',
    name: 'Samsung Galaxy S24 Ultra',
    sku: 'SGS24U-256',
    costPrice: 1100,
    prices: { yandex: 1350, uzum: 1320 },
    competitorPrices: { yandex: 1299, uzum: 1280 },
    recommendedPrice: 1290,
    profit: 190,
    profitPercent: 17.3,
  },
  {
    id: '3',
    name: 'AirPods Pro 2',
    sku: 'APP2-WHT',
    costPrice: 180,
    prices: { yandex: 249, uzum: 239 },
    competitorPrices: { yandex: 245, uzum: 235 },
    recommendedPrice: 240,
    profit: 60,
    profitPercent: 33.3,
  },
];

export function PriceManager({ connectedMarketplaces }: PriceManagerProps) {
  const [products] = useState<ProductPrice[]>(MOCK_PRICES);
  const [autoPricing, setAutoPricing] = useState(false);
  const [minProfit, setMinProfit] = useState(15);

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Narx boshqaruvi</h3>
          <p className="text-muted-foreground mb-4">
            Avval kamida bitta marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalProfit = products.reduce((sum, p) => sum + p.profit, 0);
  const avgProfitPercent = products.reduce((sum, p) => sum + p.profitPercent, 0) / products.length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calculator className="h-4 w-4" />
              O'rtacha foyda
            </div>
            <div className="text-2xl font-bold text-green-600">{avgProfitPercent.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Jami foyda
            </div>
            <div className="text-2xl font-bold">${totalProfit}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Eye className="h-4 w-4" />
              Monitoring
            </div>
            <div className="text-2xl font-bold">{products.length}</div>
            <div className="text-xs text-muted-foreground">mahsulot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <AlertCircle className="h-4 w-4" />
              Narx ogohlantirish
            </div>
            <div className="text-2xl font-bold text-orange-500">2</div>
            <div className="text-xs text-muted-foreground">raqobatchilar arzonroq</div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Narx sozlamalari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avtomatik narxlash</span>
                <Switch checked={autoPricing} onCheckedChange={setAutoPricing} />
              </div>
              <p className="text-xs text-muted-foreground">
                Raqobatchilar asosida avtomatik
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <label className="text-sm font-medium">Minimal foyda %</label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={minProfit} 
                  onChange={(e) => setMinProfit(Number(e.target.value))}
                  className="h-8"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="text-sm font-medium">Narx yuvarlash</div>
              <Badge variant="outline">99 ga tugasin</Badge>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="text-sm font-medium">Yangilash chastotasi</div>
              <Badge variant="outline">Har 1 soatda</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Narxlar va raqobat tahlili
              </CardTitle>
              <CardDescription>
                Marketplacedagi narxlar va raqobatchilar bilan taqqoslash
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Yangilash
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Mahsulot</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Tannarx</th>
                  {connectedMarketplaces.map(mp => (
                    <th key={mp} className="text-center py-3 px-2 text-sm font-medium" colSpan={2}>
                      {MARKETPLACE_NAMES[mp]}
                    </th>
                  ))}
                  <th className="text-right py-3 px-2 text-sm font-medium">Tavsiya</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Foyda</th>
                </tr>
                <tr className="border-b bg-muted/30">
                  <th></th>
                  <th></th>
                  {connectedMarketplaces.map(mp => (
                    <>
                      <th key={`${mp}-price`} className="text-center py-1 px-2 text-xs font-normal text-muted-foreground">Sizning</th>
                      <th key={`${mp}-comp`} className="text-center py-1 px-2 text-xs font-normal text-muted-foreground">Raqobat</th>
                    </>
                  ))}
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div className="font-medium text-sm">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </td>
                    <td className="text-right py-3 px-2 font-medium">
                      ${product.costPrice}
                    </td>
                    {connectedMarketplaces.map(mp => {
                      const myPrice = product.prices[mp] || 0;
                      const compPrice = product.competitorPrices[mp] || 0;
                      const isHigher = myPrice > compPrice;
                      return (
                        <>
                          <td key={`${mp}-price`} className="text-center py-3 px-2">
                            <span className={isHigher ? 'text-red-500' : 'text-green-500'}>
                              ${myPrice}
                            </span>
                          </td>
                          <td key={`${mp}-comp`} className="text-center py-3 px-2 text-muted-foreground">
                            ${compPrice}
                          </td>
                        </>
                      );
                    })}
                    <td className="text-right py-3 px-2">
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
                        ${product.recommendedPrice}
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="font-medium text-green-600">${product.profit}</div>
                      <div className="text-xs text-muted-foreground">{product.profitPercent}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ommaviy amallar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">
              <Percent className="h-4 w-4 mr-2" />
              Barcha narxlarni +5%
            </Button>
            <Button variant="outline">
              <TrendingDown className="h-4 w-4 mr-2" />
              Raqobatchilar darajasiga
            </Button>
            <Button variant="outline">
              <Calculator className="h-4 w-4 mr-2" />
              Foydani qayta hisoblash
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
