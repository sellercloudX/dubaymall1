import { useState, lazy, Suspense } from 'react';
import { MARKETPLACE_CONFIG, MarketplaceLogo } from '@/lib/marketplaceConfig';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Link2, Check, ExternalLink, Loader2, 
  Settings, RefreshCw, AlertCircle, Package, ShoppingCart, TrendingUp,
  Unplug, KeyRound
} from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

const UzumManagerInviteLazy = lazy(() => import('@/components/sellercloud/UzumManagerInvite'));

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
    logo: MARKETPLACE_CONFIG.yandex.logo,
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
    logo: MARKETPLACE_CONFIG.uzum.logo,
    color: 'from-purple-500 to-violet-500',
    requiresManualKey: true,
    fields: [
      { key: 'apiKey', label: 'API Kalit', placeholder: 'seller_api_key...' },
      { key: 'sellerId', label: 'Do\'kon ID (Shop ID)', placeholder: '12345' },
    ],
    status: 'available',
  },
   {
     id: 'wildberries',
     name: 'Wildberries',
     logo: MARKETPLACE_CONFIG.wildberries.logo,
     color: 'from-fuchsia-500 to-pink-500',
     requiresManualKey: true,
     fields: [
       { key: 'apiKey', label: 'API Token', placeholder: 'eyJhbGciOi...' },
     ],
     status: 'available',
   },
  {
    id: 'ozon',
    name: 'Ozon',
    logo: MARKETPLACE_CONFIG.ozon.logo,
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
  disconnectMarketplace: (marketplace: string) => Promise<{ success: boolean; error?: string }>;
  syncMarketplace: (marketplace: string) => Promise<void>;
  onConnect?: (marketplace: string) => void;
  store?: MarketplaceDataStore;
}

export function MarketplaceOAuth({ 
  connections, 
  isLoading, 
  connectMarketplace, 
  disconnectMarketplace,
  syncMarketplace,
  onConnect,
  store,
}: MarketplaceOAuthProps) {
  
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [settingsMode, setSettingsMode] = useState<'menu' | 'update-key'>('menu');

  const handleConnect = async (marketplace: Marketplace) => {
    if (marketplace.status === 'coming_soon') {
      toast.info(`${marketplace.name} tez kunda qo'shiladi!`);
      return;
    }

    setConnectingId(marketplace.id);
    setCredentials({});
  };

  const submitConnection = async (marketplace: Marketplace) => {
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
        if (result.data.productsCount > 0) info.push(`${result.data.productsCount} ta mahsulot`);
        if (result.data.ordersCount > 0) info.push(`${result.data.ordersCount} ta buyurtma`);
        if (info.length > 0) toast.info(`Topildi: ${info.join(', ')}`);
      }

      onConnect?.(marketplace.id);
      setConnectingId(null);
      setSettingsId(null);
      setSettingsMode('menu');
      setCredentials({});
    } catch (error: any) {
      toast.error('Ulanish xatosi: ' + (error.message || 'Noma\'lum xato'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async (marketplaceId: string) => {
    setIsDisconnecting(true);
    try {
      const result = await disconnectMarketplace(marketplaceId);
      if (result.success) {
        toast.success('Marketplace uzildi');
        setDisconnectId(null);
        setSettingsId(null);
      } else {
        toast.error('Xatolik: ' + (result.error || 'Noma\'lum xato'));
      }
    } catch (error: any) {
      toast.error('Xatolik: ' + error.message);
    } finally {
      setIsDisconnecting(false);
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

  const getConnection = (marketplaceId: string) => connections.find(c => c.marketplace === marketplaceId);
  const isConnected = (id: string) => !!getConnection(id);

  const formatNumber = (num: number) => new Intl.NumberFormat('uz-UZ').format(num);
  const formatRevenue = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return formatNumber(num);
  };

  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" /> Marketplace
        </h2>
        <span className="text-[10px] text-muted-foreground">{connections.length} ulangan</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {MARKETPLACES.map((mp) => {
            const connection = getConnection(mp.id);
            const connected = !!connection;

            return (
              <div
                key={mp.id}
                className={`rounded-xl border p-3 transition-all ${
                  connected ? 'border-primary/30 bg-primary/5' : ''
                } ${mp.status === 'coming_soon' ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Logo */}
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${mp.color} flex items-center justify-center overflow-hidden shrink-0`}>
                    <img src={mp.logo} alt={mp.name} className="w-full h-full object-cover" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{mp.name}</span>
                      {connected && (
                        <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">
                          <Check className="h-2.5 w-2.5 mr-0.5" />Ulangan
                        </Badge>
                      )}
                      {mp.status === 'coming_soon' && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">Tez kunda</Badge>
                      )}
                    </div>

                    {connected && connection ? (
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Package className="h-3 w-3" />
                          {store?.isLoadingProducts ? '...' : (store?.getProducts(mp.id)?.length || connection.products_count)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ShoppingCart className="h-3 w-3" />
                          {store?.isLoadingOrders ? '...' : (store?.getOrders(mp.id)?.length || connection.orders_count)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" />
                          {formatRevenue(connection.total_revenue)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex items-center gap-1">
                    {connected ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => handleSync(mp.id)} disabled={syncingId === mp.id}>
                          {syncingId === mp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setSettingsId(mp.id); setSettingsMode('menu'); setCredentials({}); }}>
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className={`h-7 text-xs px-3 bg-gradient-to-r ${mp.color} hover:opacity-90`}
                        onClick={() => handleConnect(mp)}
                        disabled={mp.status === 'coming_soon'}
                      >
                        <Link2 className="h-3 w-3 mr-1" /> Ulash
                      </Button>
                    )}
                  </div>
                </div>

                {/* Last sync info */}
                {connected && connection?.last_sync_at && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 pl-[52px]">
                    Sinx: {new Date(connection.last_sync_at).toLocaleString('uz-UZ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Dialog */}
      <Dialog open={!!connectingId} onOpenChange={() => setConnectingId(null)}>
        <DialogContent className="sm:max-w-md">
          {connectingId && (() => {
            const mp = MARKETPLACES.find(m => m.id === connectingId)!;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <img src={mp.logo} alt={mp.name} className="w-6 h-6 rounded object-cover" />
                    {mp.name} ulash
                  </DialogTitle>
                  <DialogDescription>
                    API kalitlarni kiriting. Bu ma'lumotlar xavfsiz saqlanadi.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">
                        API kalitni {mp.name} kabinetidan olishingiz mumkin.
                      </p>
                      <a 
                        href={
                          mp.id === 'yandex' ? 'https://partner.market.yandex.ru/settings/api-keys' :
                          mp.id === 'uzum' ? 'https://seller.uzum.uz/seller/api-keys' :
                          mp.id === 'wildberries' ? 'https://seller.wildberries.ru/supplier-settings/access-to-api' : '#'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Yo'riqnomani ko'rish <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {mp.fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Input
                        id={field.key}
                        type={field.key.includes('Key') || field.key.includes('Token') ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        value={credentials[field.key] || ''}
                        onChange={(e) => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    </div>
                  ))}

                  <Button 
                    className={`w-full bg-gradient-to-r ${mp.color}`}
                    onClick={() => submitConnection(mp)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ulanmoqda...</>
                    ) : (
                      <><Link2 className="h-4 w-4 mr-2" /> Ulash</>
                    )}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={!!settingsId} onOpenChange={() => { setSettingsId(null); setSettingsMode('menu'); }}>
        <DialogContent className="sm:max-w-md">
          {settingsId && (() => {
            const mp = MARKETPLACES.find(m => m.id === settingsId)!;
            const connection = getConnection(settingsId);

            if (settingsMode === 'update-key') {
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5" />
                      {mp.name} — API kalitni yangilash
                    </DialogTitle>
                    <DialogDescription>
                      Yangi API kalitlarni kiriting. Eski kalit almashtiriladi.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {mp.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`settings-${field.key}`}>{field.label}</Label>
                        <Input
                          id={`settings-${field.key}`}
                          type={field.key.includes('Key') || field.key.includes('Token') ? 'password' : 'text'}
                          placeholder={field.placeholder}
                          value={credentials[field.key] || ''}
                          onChange={(e) => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setSettingsMode('menu'); setCredentials({}); }}>
                        Orqaga
                      </Button>
                      <Button 
                        className={`flex-1 bg-gradient-to-r ${mp.color}`}
                        onClick={() => submitConnection(mp)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                        Yangilash
                      </Button>
                    </div>
                  </div>
                </>
              );
            }

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {mp.name} sozlamalari
                  </DialogTitle>
                  <DialogDescription>
                    Marketplace ulanishini boshqaring
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  {/* Connection info */}
                  {connection && (
                    <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Holat</span>
                        <Badge variant="default"><Check className="h-3 w-3 mr-1" /> Ulangan</Badge>
                      </div>
                      {(connection.account_info?.campaignName || connection.account_info?.storeName) && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Do'kon</span>
                          <span className="text-sm font-medium">{connection.account_info.campaignName || connection.account_info.storeName}</span>
                        </div>
                      )}
                      {connection.account_info?.campaignId && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Campaign ID</span>
                          <span className="text-sm font-mono">{connection.account_info.campaignId}</span>
                        </div>
                      )}
                      {connection.account_info?.sellerId && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Do'kon ID</span>
                          <span className="text-sm font-mono">{connection.account_info.sellerId}</span>
                        </div>
                      )}
                      {connection.last_sync_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Oxirgi sinxronizatsiya</span>
                          <span className="text-sm">{new Date(connection.last_sync_at).toLocaleString('uz-UZ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={() => { setSettingsMode('update-key'); setCredentials({}); }}
                  >
                    <KeyRound className="h-4 w-4 mr-3" />
                    API kalitni yangilash
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => { handleSync(settingsId); setSettingsId(null); }}
                  >
                    <RefreshCw className="h-4 w-4 mr-3" />
                    Ma'lumotlarni sinxronlash
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    className="w-full justify-start"
                    onClick={() => setDisconnectId(settingsId)}
                  >
                    <Unplug className="h-4 w-4 mr-3" />
                    Ulanishni uzish
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectId} onOpenChange={() => setDisconnectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ulanishni uzishni tasdiqlang</AlertDialogTitle>
            <AlertDialogDescription>
              Bu marketplace bilan ulanish uziladi. Mahsulotlar va buyurtmalar sinxronizatsiyasi to'xtaydi. 
              Qayta ulash istalgan vaqtda mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => disconnectId && handleDisconnect(disconnectId)}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unplug className="h-4 w-4 mr-2" />}
              Ha, uzish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Uzum Manager Invite — shown when Uzum is connected */}
      {isConnected('uzum') && (
        <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
          <UzumManagerInviteLazy />
        </Suspense>
      )}
    </div>
  );
}
