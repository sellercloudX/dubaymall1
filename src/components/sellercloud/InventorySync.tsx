import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, Package, AlertTriangle, Check, 
  ArrowDownUp, Clock, Settings, Bell
} from 'lucide-react';

interface InventorySyncProps {
  connectedMarketplaces: string[];
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
};

interface ProductStock {
  id: string;
  name: string;
  sku: string;
  stocks: Record<string, number>;
  totalStock: number;
  lowStockAlert: boolean;
  lastSync: string;
}

// Mock data for demo
const MOCK_PRODUCTS: ProductStock[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max 256GB',
    sku: 'IPH15PM-256',
    stocks: { yandex: 45, uzum: 30 },
    totalStock: 75,
    lowStockAlert: false,
    lastSync: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    name: 'Samsung Galaxy S24 Ultra',
    sku: 'SGS24U-256',
    stocks: { yandex: 5, uzum: 3 },
    totalStock: 8,
    lowStockAlert: true,
    lastSync: '2024-01-15T10:30:00Z',
  },
  {
    id: '3',
    name: 'AirPods Pro 2',
    sku: 'APP2-WHT',
    stocks: { yandex: 120, uzum: 80 },
    totalStock: 200,
    lowStockAlert: false,
    lastSync: '2024-01-15T10:30:00Z',
  },
];

export function InventorySync({ connectedMarketplaces }: InventorySyncProps) {
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30); // minutes
  const [isSyncing, setIsSyncing] = useState(false);
  const [products] = useState<ProductStock[]>(MOCK_PRODUCTS);

  const handleSync = async () => {
    setIsSyncing(true);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(false);
  };

  const lowStockCount = products.filter(p => p.lowStockAlert).length;

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ArrowDownUp className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Zaxira sinxronizatsiya</h3>
          <p className="text-muted-foreground mb-4">
            Avval kamida bitta marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownUp className="h-5 w-5" />
                Zaxira sinxronizatsiyasi
              </CardTitle>
              <CardDescription>
                Barcha marketplacedagi zaxiralarni avtomatik sinxronlash
              </CardDescription>
            </div>
            <Button onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sinxronlanmoqda...' : 'Hozir sinxronlash'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Auto Sync Toggle */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Avtomatik sinxronlash</span>
                  </div>
                  <Switch checked={autoSync} onCheckedChange={setAutoSync} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Har {syncInterval} daqiqada avtomatik yangilanadi
                </p>
              </CardContent>
            </Card>

            {/* Sync Status */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Oxirgi sinxronlash</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  15 daqiqa oldin • {products.length} mahsulot
                </p>
              </CardContent>
            </Card>

            {/* Low Stock Alert */}
            <Card className={lowStockCount > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-muted/50'}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`h-4 w-4 ${lowStockCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Kam qoldiq</span>
                </div>
                <p className={`text-xs ${lowStockCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {lowStockCount > 0 ? `${lowStockCount} ta mahsulot kam qolgan` : 'Barcha mahsulotlar yetarli'}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Product Stocks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mahsulotlar zaxirasi
          </CardTitle>
          <CardDescription>
            Barcha marketplacedagi zaxira holati
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Mahsulot</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">SKU</th>
                  {connectedMarketplaces.map(mp => (
                    <th key={mp} className="text-center py-3 px-2 text-sm font-medium">
                      {MARKETPLACE_NAMES[mp]}
                    </th>
                  ))}
                  <th className="text-center py-3 px-2 text-sm font-medium">Jami</th>
                  <th className="text-center py-3 px-2 text-sm font-medium">Holat</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div className="font-medium text-sm">{product.name}</div>
                    </td>
                    <td className="py-3 px-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.sku}</code>
                    </td>
                    {connectedMarketplaces.map(mp => (
                      <td key={mp} className="text-center py-3 px-2">
                        <span className={`font-medium ${(product.stocks[mp] || 0) < 10 ? 'text-red-500' : ''}`}>
                          {product.stocks[mp] || 0}
                        </span>
                      </td>
                    ))}
                    <td className="text-center py-3 px-2">
                      <span className="font-bold">{product.totalStock}</span>
                    </td>
                    <td className="text-center py-3 px-2">
                      {product.lowStockAlert ? (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Kam
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sync Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sinxronlash qoidalari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Kam qoldiq chegarasi</div>
                  <div className="text-xs text-muted-foreground">Ogohlantirish chiqarish</div>
                </div>
                <Badge variant="outline">10 dona</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Nol qoldiqda bloklash</div>
                  <div className="text-xs text-muted-foreground">Avtomatik deaktivatsiya</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Email bildirishnoma</div>
                  <div className="text-xs text-muted-foreground">Kam qoldiqda xabar</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">Telegram bot</div>
                  <div className="text-xs text-muted-foreground">Tezkor bildirishnomalar</div>
                </div>
                <Switch />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
