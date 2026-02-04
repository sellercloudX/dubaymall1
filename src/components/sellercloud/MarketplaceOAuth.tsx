import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Settings, RefreshCw, AlertCircle
} from 'lucide-react';

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
  onConnect: (marketplace: string) => void;
  connectedMarketplaces: string[];
}

export function MarketplaceOAuth({ onConnect, connectedMarketplaces }: MarketplaceOAuthProps) {
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-marketplace', {
        body: {
          shopId: 'sellercloud',
          marketplace: marketplace.id,
          ...credentials,
        },
      });

      if (error) throw error;

      onConnect(marketplace.id);
      setConnectingId(null);
      setCredentials({});
    } catch (error: any) {
      toast.error('Ulanish xatosi: ' + (error.message || 'Noma\'lum xato'));
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = (id: string) => connectedMarketplaces.includes(id);

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
          <div className="grid gap-4 md:grid-cols-2">
            {MARKETPLACES.map((mp) => (
              <Card 
                key={mp.id} 
                className={`relative overflow-hidden transition-all ${
                  isConnected(mp.id) ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''
                } ${mp.status === 'coming_soon' ? 'opacity-60' : ''}`}
              >
                {/* Status indicator */}
                <div className={`absolute top-0 right-0 w-2 h-full ${
                  isConnected(mp.id) ? 'bg-green-500' : 
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
                        <Badge variant={isConnected(mp.id) ? 'default' : mp.status === 'coming_soon' ? 'outline' : 'secondary'}>
                          {isConnected(mp.id) ? (
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
                  {isConnected(mp.id) ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Mahsulotlar:</span>
                        <span className="font-medium">0</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Buyurtmalar:</span>
                        <span className="font-medium">0</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <RefreshCw className="h-4 w-4 mr-2" />
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
            ))}
          </div>
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
                    disabled={isLoading}
                  >
                    {isLoading ? (
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
