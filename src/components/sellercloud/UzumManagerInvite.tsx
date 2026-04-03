import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  UserPlus, Phone, CheckCircle2, Clock, XCircle, AlertTriangle,
  Plug, PlugZap, Wifi, WifiOff, Shield, Copy, ExternalLink,
  RefreshCw, Loader2, Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const MANAGER_STATUSES = {
  not_invited: { label: 'Taklif qilinmagan', color: 'text-muted-foreground', icon: UserPlus },
  invited: { label: 'Taklif yuborilgan', color: 'text-warning', icon: Clock },
  pending: { label: 'Kutilmoqda', color: 'text-warning', icon: Clock },
  active: { label: 'Faol', color: 'text-success', icon: CheckCircle2 },
  revoked: { label: 'Bekor qilingan', color: 'text-destructive', icon: XCircle },
};

interface ExtensionStatus {
  connected: boolean;
  lastPing: string | null;
  version: string | null;
  pendingCommands: number;
}

export default function UzumManagerInvite() {
  const { user } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [managerPhone, setManagerPhone] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({
    connected: false,
    lastPing: null,
    version: null,
    pendingCommands: 0,
  });

  const loadAccount = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('uzum_accounts')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (data) {
        setAccount(data);
        setManagerPhone((data as any).manager_phone || '');
      }

      // Check if real API key already exists in marketplace_connections
      const { data: conn } = await supabase
        .from('marketplace_connections')
        .select('credentials')
        .eq('user_id', user.id)
        .eq('marketplace', 'uzum')
        .maybeSingle();

      if (conn?.credentials) {
        const creds = conn.credentials as any;
        const existingKey = typeof creds.apiKey === 'string' ? creds.apiKey.trim() : '';
        if (existingKey && existingKey !== 'manager_session') {
          setApiKeySaved(true);
          setApiKey(existingKey.substring(0, 8) + '...');
        }
      }

      // Check pending extension commands
      const { count } = await supabase
        .from('uzum_extension_commands')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');

      // Check latest extension activity (heartbeat, completed, or processing commands)
      const { data: lastActivity } = await supabase
        .from('uzum_extension_commands')
        .select('status, processed_at, created_at, command_type, payload')
        .eq('user_id', user.id)
        .in('status', ['processing', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Consider connected if activity within last 24 hours
      const isRecent = lastActivity && (
        new Date().getTime() - new Date(lastActivity.processed_at || lastActivity.created_at).getTime() < 24 * 60 * 60 * 1000
      );

      const version = lastActivity?.command_type === 'heartbeat' 
        ? (lastActivity.payload as any)?.version || null 
        : null;

      setExtensionStatus(prev => ({
        ...prev,
        pendingCommands: count || 0,
        connected: !!isRecent,
        lastPing: (lastActivity?.processed_at as string | null) || (lastActivity?.created_at as string | null) || null,
        version,
      }));
    } catch (err) {
      console.error('Failed to load account:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  // Listen for extension commands status changes (realtime)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('extension-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'uzum_extension_commands',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const cmd = payload.new as any;
        if (cmd.status === 'completed' || cmd.status === 'processing') {
          setExtensionStatus(prev => ({
            ...prev,
            connected: true,
            lastPing: new Date().toISOString(),
          }));
          if (cmd.status === 'completed') {
            toast({ title: 'Buyruq bajarildi', description: `${cmd.command_type} muvaffaqiyatli` });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const inviteManager = async () => {
    if (!user || !managerPhone) return;
    setIsSaving(true);
    try {
      if (!account) {
        // Create account first
        const { data: newAcc, error: accErr } = await supabase
          .from('uzum_accounts')
          .insert({
            user_id: user.id,
            shop_name: 'Default',
            manager_phone: managerPhone,
            manager_status: 'invited',
            manager_invited_at: new Date().toISOString(),
          } as any)
          .select()
          .single();
        if (accErr) throw accErr;
        setAccount(newAcc);
      } else {
        const { error } = await supabase
          .from('uzum_accounts')
          .update({
            manager_phone: managerPhone,
            manager_status: 'invited',
            manager_invited_at: new Date().toISOString(),
          } as any)
          .eq('id', account.id);
        if (error) throw error;
        setAccount((prev: any) => ({ ...prev, manager_phone: managerPhone, manager_status: 'invited' }));
      }
      toast({ title: 'Taklif yuborildi', description: 'Manager taklif holati yangilandi' });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmManagerActive = async () => {
    if (!account || !user) return;
    setIsSaving(true);
    try {
      // 1. Update uzum_accounts status to active
      const { error: accErr } = await supabase
        .from('uzum_accounts')
        .update({
          manager_status: 'active',
          manager_connected_at: new Date().toISOString(),
        } as any)
        .eq('id', account.id);
      if (accErr) throw accErr;

      // 2. Create/update marketplace_connections entry so the whole system recognizes Uzum
      // IMPORTANT: preserve existing real API credentials (don't overwrite with manager_session)
      const { data: existingConn } = await supabase
        .from('marketplace_connections')
        .select('credentials, account_info')
        .eq('user_id', user.id)
        .eq('marketplace', 'uzum')
        .maybeSingle();

      const existingCredentials = ((existingConn?.credentials as any) || {}) as Record<string, any>;
      const existingAccountInfo = ((existingConn?.account_info as any) || {}) as Record<string, any>;

      const sellerId = String(
        (account as any).shop_id ||
        existingAccountInfo.shopId ||
        existingAccountInfo.sellerId ||
        existingCredentials.sellerId ||
        ''
      );

      const existingApiKey =
        typeof existingCredentials.apiKey === 'string' ? existingCredentials.apiKey.trim() : '';

      const nextCredentials = {
        ...existingCredentials,
        sellerId,
        apiKey:
          existingApiKey && existingApiKey !== 'manager_session'
            ? existingApiKey
            : ((account as any).api_key || 'manager_session'),
      };

      const nextAccountInfo = {
        ...existingAccountInfo,
        storeName: (account as any).shop_name || existingAccountInfo.storeName || 'Uzum Do\'kon',
        sellerId,
        shopId: sellerId || existingAccountInfo.shopId,
        connectionType: 'manager',
        managerPhone: managerPhone || (account as any).manager_phone || '',
      };

      const { error: connErr } = await supabase
        .from('marketplace_connections')
        .upsert({
          user_id: user.id,
          marketplace: 'uzum',
          credentials: nextCredentials,
          is_active: true,
          account_info: nextAccountInfo,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,marketplace' });
      if (connErr) {
        // If unique constraint doesn't exist on user_id,marketplace, try insert
        const { error: insertErr } = await supabase
          .from('marketplace_connections')
          .insert({
            user_id: user.id,
            marketplace: 'uzum',
            credentials: nextCredentials,
            is_active: true,
            account_info: nextAccountInfo,
          });
        if (insertErr && !insertErr.message.includes('duplicate')) throw insertErr;
      }

      setAccount((prev: any) => ({ ...prev, manager_status: 'active' }));
      toast({ 
        title: '✅ Uzum Market ulandi!', 
        description: 'Manager muvaffaqiyatli tasdiqlandi. Endi barcha funksiyalar ishlaydi.' 
      });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const revokeManager = async () => {
    if (!account) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('uzum_accounts')
        .update({ manager_status: 'revoked', session_token: null } as any)
        .eq('id', account.id);
      if (error) throw error;
      setAccount((prev: any) => ({ ...prev, manager_status: 'revoked' }));
      toast({ title: 'Bekor qilindi', description: 'Manager ruxsati olib tashlandi' });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveApiKey = async () => {
    if (!user || !apiKey.trim() || apiKey.includes('...')) return;
    setIsSaving(true);
    try {
      // Get existing connection
      const { data: conn } = await supabase
        .from('marketplace_connections')
        .select('id, credentials, account_info')
        .eq('user_id', user.id)
        .eq('marketplace', 'uzum')
        .maybeSingle();

      if (!conn) {
        // Create new connection with the API key
        const { error } = await supabase
          .from('marketplace_connections')
          .insert({
            user_id: user.id,
            marketplace: 'uzum',
            credentials: { apiKey: apiKey.trim(), sellerId: '' },
            is_active: true,
            account_info: { connectionType: 'manager', storeName: 'Uzum Do\'kon' },
          });
        if (error) throw error;
      } else {
        // Update existing connection with real API key
        const existingCreds = (conn.credentials as any) || {};
        const { error } = await supabase
          .from('marketplace_connections')
          .update({
            credentials: { ...existingCreds, apiKey: apiKey.trim() },
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id);
        if (error) throw error;
      }

      // Also save to uzum_accounts
      if (account) {
        await supabase
          .from('uzum_accounts')
          .update({ api_key: apiKey.trim() } as any)
          .eq('id', account.id);
      }

      setApiKeySaved(true);
      toast({ title: '✅ API kalit saqlandi!', description: 'Endi ma\'lumotlar sinxronlanadi.' });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const managerStatus = account?.manager_status || 'not_invited';
  const statusInfo = MANAGER_STATUSES[managerStatus as keyof typeof MANAGER_STATUSES] || MANAGER_STATUSES.not_invited;
  const StatusIcon = statusInfo.icon;
  const canShowConfirmInline = !!account && managerStatus !== 'active';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Extension Connection Status */}
      <Card className={`border-2 ${extensionStatus.connected ? 'border-success/30 bg-success/5' : 'border-border'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {extensionStatus.connected ? (
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <PlugZap className="w-5 h-5 text-success" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-foreground">
                  Chrome Extension {extensionStatus.connected ? 'ulangan' : 'ulanmagan'}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {extensionStatus.connected
                    ? `Oxirgi faoliyat: ${extensionStatus.lastPing ? new Date(extensionStatus.lastPing).toLocaleTimeString() : '—'}`
                    : 'Extension hali tizimga ping yubormagan (popupdan Kirish bosing)'
                  }
                </div>
              </div>
            </div>
            <div className="text-right">
              {extensionStatus.pendingCommands > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {extensionStatus.pendingCommands} kutilmoqda
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manager Invite */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Manager taklif qilish
            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
              <StatusIcon className="w-3 h-3 mr-0.5" />
              {statusInfo.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Card className="border-border/50 bg-muted/20">
            <CardContent className="p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <strong>Manager roli nima?</strong> Uzum Seller kabinetida «Менеджер» sifatida tizimimiz telefon raqamini qo'shib, 
                biz sizning do'koningizdan qo'shimcha ma'lumotlarni (batafsil FBO hisobotlar, Boost sozlamalari) 
                headless brauzer orqali olishimiz mumkin bo'ladi. Bu API orqali kelmayatgan ma'lumotlarni yig'ish uchun kerak.
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" /> Tizim telefon raqami (Manager uchun)
            </Label>
            <div className="flex gap-2">
              <Input
                value={managerPhone}
                onChange={e => setManagerPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="h-8 text-xs flex-1"
                disabled={managerStatus === 'active'}
              />
              {managerStatus !== 'active' ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={inviteManager} disabled={isSaving || !managerPhone} className="h-8 text-xs">
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3 mr-1" />}
                    Taklif
                  </Button>
                  {canShowConfirmInline && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={confirmManagerActive}
                      disabled={isSaving || !managerPhone}
                      className="h-8 text-xs"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Tasdiqlash
                    </Button>
                  )}
                </div>
              ) : (
                <Button variant="destructive" size="sm" onClick={revokeManager} disabled={isSaving} className="h-8 text-xs">
                  <XCircle className="w-3 h-3 mr-1" />
                  Bekor
                </Button>
              )}
            </div>
          </div>

          {/* Steps - always show */}
          <Separator />
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground">Qadamlar:</div>
            <div className="space-y-1.5">
              {[
                { step: 1, text: 'Uzum Seller → Sozlamalar → Xodimlar bo\'limiga o\'ting', done: managerStatus !== 'not_invited' },
                { step: 2, text: `"Менеджер қўшиш" tugmasini bosing va ${managerPhone || 'raqamni'} kiriting`, done: ['pending', 'active'].includes(managerStatus) },
                { step: 3, text: 'Qo\'shib bo\'lgach, pastdagi "Ulanishni tasdiqlash" tugmasini bosing', done: managerStatus === 'active' },
              ].map(item => (
                <div key={item.step} className="flex items-center gap-2 text-[11px]">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    item.done ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.done ? <CheckCircle2 className="w-3 h-3" /> : item.step}
                  </div>
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confirmation button - show when not active */}
          {managerStatus !== 'active' && (
            <div className="pt-2">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3 space-y-2">
                  <div className="text-[11px] text-muted-foreground">
                    Uzum Seller kabinetida manager sifatida qo'shib bo'ldingizmi?
                  </div>
                  <Button 
                    onClick={confirmManagerActive} 
                    disabled={isSaving || !managerPhone}
                    className="w-full h-9 text-xs"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                    Ha, ulanishni tasdiqlash
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Key Input */}
      <Card className={`border-2 ${apiKeySaved ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Uzum Seller OpenAPI kalit
            {apiKeySaved && (
              <Badge variant="secondary" className="text-[10px] text-success">
                <CheckCircle2 className="w-3 h-3 mr-0.5" />
                Saqlangan
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <strong>Uzum Seller</strong> → Sozlamalar → API bo'limidan OpenAPI kalitni oling va pastga kiriting. 
            Bu kalit mahsulotlar, buyurtmalar va moliya ma'lumotlarini olish uchun kerak.
          </div>
          <div className="flex gap-2">
            <Input
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setApiKeySaved(false); }}
              placeholder="API kalitni kiriting..."
              className="h-8 text-xs flex-1 font-mono"
              type="password"
            />
            <Button
              size="sm"
              onClick={saveApiKey}
              disabled={isSaving || !apiKey.trim() || apiKey.includes('...')}
              className="h-8 text-xs"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Saqlash
            </Button>
          </div>
          {!apiKeySaved && (
            <div className="flex items-start gap-2 text-[10px] text-warning">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              API kalit kiritilmagan — ma'lumotlarni sinxronlash mumkin emas.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-border/50">
        <CardContent className="p-3 flex items-start gap-2">
          <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <strong>Xavfsizlik:</strong> Manager roli faqat o'qish huquqini beradi. Sizning do'koningizdagi 
            mahsulotlar, narxlar va buyurtmalar xavfsiz. Manager ruxsatini istalgan vaqtda bekor qilishingiz mumkin.
            Barcha ma'lumotlar shifrlangan holda saqlanadi.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
