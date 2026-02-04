import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Link2, Check, ExternalLink, Loader2, 
  Settings, RefreshCw, AlertCircle, Package, ShoppingCart, TrendingUp
} from 'lucide-react';
interface MarketplaceConnection {
  id: string;
  marketplace: string;
  account_info: {
    campaignName?: string;
    storeName?: string;
    state?: string;
    campaignId?: string;
    sellerId?: string;
  };
  products_count: number;
  orders_count: number;
  total_revenue: number;
  last_sync_at: string | null;
  is_active: boolean;
}

interface Marketplace {
  id: string;
  name: string;
  logo: string;
  color: string;
  oauthUrl?: string;
  requiresManualKey: boolean;
  fields: { key: string; label: string; placeholder: string }[];
  status: 'available' | 'coming_soon';
}

const MARKETPLACES: Marketplace[] = [
  {
    id: 'yandex',
    name: 'Yandex Market',
    logo: '🟡',
    color: 'from-yellow-500 to-amber-500',
    oauthUrl: 'https://oauth.yandex.ru/authorize',
    requiresManualKey: true,
    fields: [
      { key: 'apiKey', label: 'OAuth Token', placeholder: 'y0_AgAAAA...' },
      { key: 'campaignId', label: 'Campaign ID', placeholder: '12345678' },
    ],
    status: 'available',
  },
  {
    id: 'uzum',
    name: 'Uzum Market',
    logo: '🟣',
    color: 'from-purple-500 to-violet-500',
    requiresManualKey: true,
    fields: [
      { key: 'apiKey', label: 'API Kalit', placeholder: 'uzum_api_...' },
      { key: 'sellerId', label: 'Seller ID', placeholder: 'S12345' },
    ],
    status: 'available',
  },
  {
    id: 'wildberries',
    name: 'Wildberries',
    logo: '🟣',
    color: 'from-fuchsia-500 to-pink-500',
    requiresManualKey: true,
    fields: [
      { key: 'apiKey', label: 'API Token', placeholder: 'eyJhbGciOi...' },
    ],
    status: 'coming_soon',
  },
  {
    id: 'ozon',
    name: 'Ozon',
    logo: '🔵',
    color: 'from-blue-500 to-cyan-500',
    requiresManualKey: true,
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: '123456' },
      { key: 'apiKey', label: 'API Key', placeholder: 'your-api-key' },
    ],
    status: 'coming_soon',
  },
];

interface MarketplaceOAuthProps {
  connections: MarketplaceConnection[];
  isLoading: boolean;
  connectMarketplace: (marketplace: string, credentials: Record<string, string>) => Promise<{ success: boolean; error?: string; data?: any }>;
  syncMarketplace: (marketplace: string) => Promise<void>;
  onConnect?: (marketplace: string) => void;
}

export function MarketplaceOAuth({ 
  connections, 
  isLoading, 
  connectMarketplace, 
  syncMarketplace,
  onConnect 
}: MarketplaceOAuthProps) {
  
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const handleConnect = async (marketplace: Marketplace) => {
    if (marketplace.status === 'coming_soon') {
      toast.info(`${marketplace.name} tez kunda qo'shiladi!`);
      return;
    }

    setConnectingId(marketplace.id);
    setCredentials({});
  };

  const submitConnection = async (marketplace: Marketplace) => {
    // Validate required fields
    const missingFields = marketplace.fields.filter(f => !credentials[f.key]);
    if (missingFields.length > 0) {
      toast.error(`${missingFields[0].label} ni kiriting`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await connectMarketplace(marketplace.id, credentials);

      if (!result.success) {
        toast.error('Ulanish xatosi: ' + (result.error || 'Noma\'lum xato'));
        return;
      }

      toast.success(`${marketplace.name} muvaffaqiyatli ulandi!`);
      
      if (result.data) {
        const info = [];
        if (result.data.productsCount > 0) {
          info.push(`${result.data.productsCount} ta mahsulot`);
        }
        if (result.data.ordersCount > 0) {
          info.push(`${result.data.ordersCount} ta buyurtma`);
        }
        if (info.length > 0) {
          toast.info(`Topildi: ${info.join(', ')}`);
        }
      }

      onConnect?.(marketplace.id);
      setConnectingId(null);
      setCredentials({});
    } catch (error: any) {
      toast.error('Ulanish xatosi: ' + (error.message || 'Noma\'lum xato'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (marketplaceId: string) => {
    setSyncingId(marketplaceId);
    try {
      await syncMarketplace(marketplaceId);
      toast.success('Ma\'lumotlar yangilandi');
    } catch (error) {
      toast.error('Sinxronizatsiya xatosi');
    } finally {
      setSyncingId(null);
    }
  };

  const getConnection = (marketplaceId: string) => {
    return connections.find(c => c.marketplace === marketplaceId);
  };

  const isConnected = (id: string) => !!getConnection(id);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('uz-UZ').format(num);
  };

  const formatRevenue = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return formatNumber(num);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Marketplace ulanishlari
          </CardTitle>
          <CardDescription>
            API kalitlar orqali marketplacelarni ulang. Ulangandan so'ng barcha 
            mahsulotlar va buyurtmalarni shu yerdan boshqarishingiz mumkin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <Skeleton className="h-4 w-24 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {MARKETPLACES.map((mp) => {
                const connection = getConnection(mp.id);
                const connected = !!connection;

                return (
                  <Card 
                    key={mp.id} 
                    className={`relative overflow-hidden transition-all ${
                      connected ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''
                    } ${mp.status === 'coming_soon' ? 'opacity-60' : ''}`}
                  >
                    {/* Status indicator */}
                    <div className={`absolute top-0 right-0 w-2 h-full ${
                      connected ? 'bg-green-500' : 
                      mp.status === 'coming_soon' ? 'bg-gray-300' : 'bg-gray-400'
                    }`} />
                    
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mp.color} flex items-center justify-center text-2xl`}>
                            {mp.logo}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{mp.name}</CardTitle>
                            <Badge variant={connected ? 'default' : mp.status === 'coming_soon' ? 'outline' : 'secondary'}>
                              {connected ? (
                                <><Check className="h-3 w-3 mr-1" /> Ulangan</>
                              ) : mp.status === 'coming_soon' ? (
                                'Tez kunda'
                              ) : (
                                'Ulanmagan'
                              )}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {connected && connection ? (
                        <div className="space-y-3">
                          {/* Store name */}
                          {connection.account_info?.campaignName && (
                            <p className="text-sm font-medium text-muted-foreground">
                              {connection.account_info.campaignName}
                            </p>
                          )}
                          
                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-muted/50">
                              <Package className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                              <div className="text-lg font-bold">{formatNumber(connection.products_count)}</div>
                              <div className="text-xs text-muted-foreground">Mahsulotlar</div>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/50">
                              <ShoppingCart className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                              <div className="text-lg font-bold">{formatNumber(connection.orders_count)}</div>
                              <div className="text-xs text-muted-foreground">Buyurtmalar</div>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/50">
                              <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                              <div className="text-lg font-bold">{formatRevenue(connection.total_revenue)}</div>
                              <div className="text-xs text-muted-foreground">Daromad</div>
                            </div>
                          </div>

                          {/* Last sync */}
                          {connection.last_sync_at && (
                            <p className="text-xs text-muted-foreground text-center">
                              Oxirgi sinxronizatsiya: {new Date(connection.last_sync_at).toLocaleString('uz-UZ')}
                            </p>
                          )}
                          
                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => handleSync(mp.id)}
                              disabled={syncingId === mp.id}
                            >
                              {syncingId === mp.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              Sinxronlash
                            </Button>
                            <Button variant="outline" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          className={`w-full bg-gradient-to-r ${mp.color} hover:opacity-90`}
                          onClick={() => handleConnect(mp)}
                          disabled={mp.status === 'coming_soon'}
                        >
                          {mp.status === 'coming_soon' ? (
                            'Tez kunda'
                          ) : (
                            <>
                              <Link2 className="h-4 w-4 mr-2" />
                              Ulash
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Dialog */}
      <Dialog open={!!connectingId} onOpenChange={() => setConnectingId(null)}>
        <DialogContent className="sm:max-w-md">
          {connectingId && (() => {
            const mp = MARKETPLACES.find(m => m.id === connectingId)!;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-2xl">{mp.logo}</span>
                    {mp.name} ulash
                  </DialogTitle>
                  <DialogDescription>
                    API kalitlarni kiriting. Bu ma'lumotlar xavfsiz saqlanadi.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Help link */}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">
                        API kalitni {mp.name} kabinetidan olishingiz mumkin.
                      </p>
                      <a 
                        href={mp.id === 'yandex' ? 'https://partner.market.yandex.ru/settings/api-keys' : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Yo'riqnomani ko'rish
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Form fields */}
                  {mp.fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Input
                        id={field.key}
                        type={field.key.includes('Key') || field.key.includes('Token') ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        value={credentials[field.key] || ''}
                        onChange={(e) => setCredentials(prev => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))}
                      />
                    </div>
                  ))}

                  <Button 
                    className={`w-full bg-gradient-to-r ${mp.color}`}
                    onClick={() => submitConnection(mp)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
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
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
