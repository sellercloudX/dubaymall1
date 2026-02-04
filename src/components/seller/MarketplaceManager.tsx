import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AIScannerPro } from './AIScannerPro';
import { 
  Store, Link2, Check, X, Settings, 
  BarChart3, Package, TrendingUp, ExternalLink,
  Loader2, Plus, RefreshCw
} from 'lucide-react';

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  status: 'connected' | 'disconnected' | 'pending';
  apiKey?: string;
  campaignId?: string;
  lastSync?: string;
  productsCount?: number;
  ordersCount?: number;
}

interface MarketplaceManagerProps {
  shopId: string;
}

export function MarketplaceManager({ shopId }: MarketplaceManagerProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<MarketplaceConnection[]>([
    {
      id: 'yandex',
      marketplace: 'Yandex Market',
      status: 'disconnected',
      productsCount: 0,
      ordersCount: 0,
    },
    {
      id: 'uzum',
      marketplace: 'Uzum Market',
      status: 'disconnected',
      productsCount: 0,
      ordersCount: 0,
    },
    {
      id: 'wildberries',
      marketplace: 'Wildberries',
      status: 'disconnected',
      productsCount: 0,
      ordersCount: 0,
    },
    {
      id: 'ozon',
      marketplace: 'Ozon',
      status: 'disconnected',
      productsCount: 0,
      ordersCount: 0,
    },
  ]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingMarketplace, setConnectingMarketplace] = useState<string | null>(null);
  const [apiCredentials, setApiCredentials] = useState({ apiKey: '', campaignId: '' });

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-marketplace-connections', {
        body: { shopId },
      });

      if (data?.connections) {
        setConnections(prev => prev.map(conn => {
          const serverConn = data.connections.find((c: any) => c.id === conn.id);
          return serverConn ? { ...conn, ...serverConn } : conn;
        }));
      }
    } catch (error) {
      console.error('Failed to check connections:', error);
    }
  };

  const handleConnect = async (marketplaceId: string) => {
    if (!apiCredentials.apiKey) {
      toast.error('API kalitini kiriting');
      return;
    }

    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-marketplace', {
        body: {
          shopId,
          marketplace: marketplaceId,
          apiKey: apiCredentials.apiKey,
          campaignId: apiCredentials.campaignId,
        },
      });

      if (error) throw error;

      setConnections(prev => prev.map(conn =>
        conn.id === marketplaceId
          ? { ...conn, status: 'connected' as const, ...apiCredentials }
          : conn
      ));

      toast.success(`${marketplaceId} muvaffaqiyatli ulandi!`);
      setConnectingMarketplace(null);
      setApiCredentials({ apiKey: '', campaignId: '' });
    } catch (error: any) {
      toast.error('Ulanish xatosi: ' + (error.message || 'Noma\'lum xato'));
    } finally {
      setIsConnecting(false);
    }
  };

  const getMarketplaceLogo = (id: string) => {
    const logos: Record<string, string> = {
      yandex: '🟡',
      uzum: '🟣',
      wildberries: '🟣',
      ozon: '🔵',
    };
    return logos[id] || '📦';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="scanner" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scanner" className="gap-2">
            <Package className="h-4 w-4" />
            AI Scanner Pro
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-2">
            <Link2 className="h-4 w-4" />
            Ulanishlar
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analitika
          </TabsTrigger>
        </TabsList>

        {/* AI Scanner Pro Tab */}
        <TabsContent value="scanner">
          <AIScannerPro shopId={shopId} />
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Marketplace ulanishlari
                </span>
                <Button variant="outline" size="sm" onClick={checkConnections}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Yangilash
                </Button>
              </CardTitle>
              <CardDescription>
                API kalitlari orqali marketplacelarni ulang va mahsulotlarni boshqaring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {connections.map((connection) => (
                  <Card key={connection.id} className="relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-2 h-full ${getStatusColor(connection.status)}`} />
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getMarketplaceLogo(connection.id)}</span>
                          <div>
                            <CardTitle className="text-lg">{connection.marketplace}</CardTitle>
                            <Badge 
                              variant={connection.status === 'connected' ? 'default' : 'secondary'}
                              className="mt-1"
                            >
                              {connection.status === 'connected' ? 'Ulangan' : 'Ulanmagan'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {connection.status === 'connected' ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Mahsulotlar:</span>
                            <span className="font-medium">{connection.productsCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Buyurtmalar:</span>
                            <span className="font-medium">{connection.ordersCount}</span>
                          </div>
                          {connection.lastSync && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Oxirgi sinxron:</span>
                              <span>{new Date(connection.lastSync).toLocaleString('uz')}</span>
                            </div>
                          )}
                          <Button variant="outline" size="sm" className="w-full mt-2">
                            <Settings className="h-4 w-4 mr-2" />
                            Sozlamalar
                          </Button>
                        </div>
                      ) : (
                        <Dialog 
                          open={connectingMarketplace === connection.id} 
                          onOpenChange={(open) => {
                            if (!open) {
                              setConnectingMarketplace(null);
                              setApiCredentials({ apiKey: '', campaignId: '' });
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              className="w-full"
                              onClick={() => setConnectingMarketplace(connection.id)}
                              disabled={connection.id !== 'yandex'}
                            >
                              {connection.id === 'yandex' ? (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Ulash
                                </>
                              ) : (
                                <>
                                  <span className="mr-2">🔒</span>
                                  Tez kunda
                                </>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <span>{getMarketplaceLogo(connection.id)}</span>
                                {connection.marketplace} API ulanishi
                              </DialogTitle>
                              <DialogDescription>
                                API kalitingizni kiriting. Bu ma'lumotlar xavfsiz saqlanadi.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <div className="space-y-2">
                                <Label htmlFor="apiKey">API kalit (OAuth token)</Label>
                                <Input
                                  id="apiKey"
                                  type="password"
                                  placeholder="y0_AgAAAA..."
                                  value={apiCredentials.apiKey}
                                  onChange={(e) => setApiCredentials(prev => ({
                                    ...prev,
                                    apiKey: e.target.value
                                  }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="campaignId">Campaign ID (Do'kon ID)</Label>
                                <Input
                                  id="campaignId"
                                  placeholder="12345678"
                                  value={apiCredentials.campaignId}
                                  onChange={(e) => setApiCredentials(prev => ({
                                    ...prev,
                                    campaignId: e.target.value
                                  }))}
                                />
                              </div>
                              <Button 
                                className="w-full"
                                onClick={() => handleConnect(connection.id)}
                                disabled={isConnecting}
                              >
                                {isConnecting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Ulanmoqda...
                                  </>
                                ) : (
                                  <>
                                    <Link2 className="h-4 w-4 mr-2" />
                                    Ulash
                                  </>
                                )}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Marketplace analitikasi
              </CardTitle>
              <CardDescription>
                Barcha marketplacelar bo'yicha umumiy statistika
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Analitika uchun avval marketplace ulang</p>
                <p className="text-sm mt-2">
                  Yandex Market API orqali ulanganingizdan so'ng statistika ko'rinadi
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
