import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  UserPlus, Phone, CheckCircle2, Clock, XCircle, AlertTriangle,
  Shield, Copy, ExternalLink, RefreshCw, Loader2, Info, Smartphone,
  Store, ArrowRight, Sparkles, CircleDot, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

// Platform's designated manager phone number
const PLATFORM_MANAGER_PHONE = '+998 90 009 00 09';

const STEPS = [
  {
    id: 'open-settings',
    title: 'Uzum Seller kabinetini oching',
    description: 'seller.uzum.uz → Sozlamalar → Xodimlar',
    icon: Store,
  },
  {
    id: 'add-manager',
    title: 'Raqamni manager qilib qo\'shing',
    description: `"Менеджер қўшиш" → ${PLATFORM_MANAGER_PHONE}`,
    icon: UserPlus,
  },
  {
    id: 'confirm',
    title: 'Platformada tasdiqlang',
    description: 'Qo\'shib bo\'lgach "Tasdiqlash" tugmasini bosing',
    icon: CheckCircle2,
  },
];

interface ManagerStatus {
  status: 'not_started' | 'invited' | 'pending' | 'active' | 'revoked';
  label: string;
  color: string;
}

const STATUS_MAP: Record<string, ManagerStatus> = {
  not_invited: { status: 'not_started', label: 'Boshlanmagan', color: 'text-muted-foreground' },
  invited: { status: 'invited', label: 'Yuborilgan', color: 'text-warning' },
  pending: { status: 'pending', label: 'Kutilmoqda', color: 'text-warning' },
  active: { status: 'active', label: 'Faol', color: 'text-success' },
  revoked: { status: 'revoked', label: 'Bekor qilingan', color: 'text-destructive' },
};

export default function UzumManagerInvite() {
  const { user } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shopId, setShopId] = useState('');
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

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
        setShopId((data as any).shop_id || '');
      }
    } catch (err) {
      console.error('Failed to load account:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(PLATFORM_MANAGER_PHONE.replace(/\s/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Nusxalandi!', description: 'Telefon raqami nusxalandi' });
    } catch {
      toast({ title: 'Xato', description: 'Nusxalab bo\'lmadi', variant: 'destructive' });
    }
  };

  const confirmManagerActive = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // 1. Create/update uzum_accounts
      if (!account) {
        const { data: newAcc, error: accErr } = await supabase
          .from('uzum_accounts')
          .insert({
            user_id: user.id,
            shop_name: 'Uzum Do\'kon',
            shop_id: shopId || null,
            manager_phone: PLATFORM_MANAGER_PHONE.replace(/\s/g, ''),
            manager_status: 'active',
            manager_invited_at: new Date().toISOString(),
            manager_connected_at: new Date().toISOString(),
          } as any)
          .select()
          .single();
        if (accErr) throw accErr;
        setAccount(newAcc);
      } else {
        const { error } = await supabase
          .from('uzum_accounts')
          .update({
            manager_phone: PLATFORM_MANAGER_PHONE.replace(/\s/g, ''),
            manager_status: 'active',
            manager_connected_at: new Date().toISOString(),
            ...(shopId ? { shop_id: shopId } : {}),
          } as any)
          .eq('id', account.id);
        if (error) throw error;
        setAccount((prev: any) => ({ ...prev, manager_status: 'active' }));
      }

      // 2. Create/update marketplace_connections
      const { data: existingConn } = await supabase
        .from('marketplace_connections')
        .select('id, credentials, account_info')
        .eq('user_id', user.id)
        .eq('marketplace', 'uzum')
        .maybeSingle();

      const existingCreds = ((existingConn?.credentials as any) || {}) as Record<string, any>;
      const existingInfo = ((existingConn?.account_info as any) || {}) as Record<string, any>;

      const nextCredentials = {
        ...existingCreds,
        sellerId: shopId || existingCreds.sellerId || '',
        apiKey: existingCreds.apiKey && existingCreds.apiKey !== 'manager_session' 
          ? existingCreds.apiKey 
          : 'manager_session',
        connectionType: 'manager',
      };

      const nextAccountInfo = {
        ...existingInfo,
        storeName: existingInfo.storeName || 'Uzum Do\'kon',
        sellerId: shopId || existingInfo.sellerId || '',
        shopId: shopId || existingInfo.shopId || '',
        connectionType: 'manager',
        managerPhone: PLATFORM_MANAGER_PHONE.replace(/\s/g, ''),
      };

      const connPayload = {
        user_id: user.id,
        marketplace: 'uzum',
        credentials: nextCredentials,
        is_active: true,
        account_info: nextAccountInfo,
        updated_at: new Date().toISOString(),
      };

      if (existingConn) {
        await supabase
          .from('marketplace_connections')
          .update(connPayload)
          .eq('id', existingConn.id);
      } else {
        await supabase
          .from('marketplace_connections')
          .insert(connPayload);
      }

      toast({
        title: '✅ Uzum Market ulandi!',
        description: 'Manager muvaffaqiyatli tasdiqlandi. Barcha funksiyalar ishlaydi.',
      });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const verifyConnection = async () => {
    if (!user) return;
    setIsVerifying(true);
    try {
      // Try to invoke uzum-manager-auth to verify the session works
      const { data, error } = await supabase.functions.invoke('uzum-manager-auth', {
        body: { action: 'verify', userId: user.id },
      });

      if (error) throw error;
      if (data?.success) {
        toast({ title: '✅ Ulanish tasdiqlandi!', description: 'Manager sessiyasi ishlayapti.' });
      } else {
        toast({ 
          title: '⚠️ Sessiya topilmadi', 
          description: data?.message || 'Manager raqami hali qo\'shilmagan bo\'lishi mumkin.', 
          variant: 'destructive',
        });
      }
    } catch {
      toast({ 
        title: 'Tekshirib bo\'lmadi', 
        description: 'Backend funksiyasi hali sozlanmagan. Manager statusini qo\'lda tasdiqlang.',
      });
    } finally {
      setIsVerifying(false);
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

  const managerStatus = account?.manager_status || 'not_invited';
  const isActive = managerStatus === 'active';
  const statusInfo = STATUS_MAP[managerStatus] || STATUS_MAP.not_invited;
  const currentStep = isActive ? 3 : managerStatus === 'invited' || managerStatus === 'pending' ? 1 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-sm font-medium">
            Uzum Manager: <span className={statusInfo.color}>{statusInfo.label}</span>
          </span>
        </div>
        {isActive && (
          <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-success/20">
            <Sparkles className="w-3 h-3 mr-1" />
            To'liq ruxsat
          </Badge>
        )}
      </div>

      {/* Success state */}
      {isActive && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Manager ulangan ✅</div>
                <div className="text-[11px] text-muted-foreground">
                  Uzum Market do'koningiz to'liq boshqarilmoqda. Mahsulot yaratish, buyurtmalar va hisobotlar avtomatik ishlaydi.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={verifyConnection} disabled={isVerifying}>
                {isVerifying ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Tekshirish
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={revokeManager} disabled={isSaving}>
                <XCircle className="w-3 h-3 mr-1" />
                Bekor qilish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup wizard - show when not active */}
      {!isActive && (
        <>
          {/* Info card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-[12px] text-muted-foreground leading-relaxed space-y-2">
                  <p>
                    <strong>Manager ulanishi</strong> — Chrome extension va API kalitga muqobil. 
                    Uzum Seller kabinetida bizning raqamni <strong>Manager</strong> sifatida qo'shsangiz, 
                    platforma to'liq ishlaydi:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Mahsulot yaratish', 'Buyurtmalar', 'Hisobotlar', 'Narx boshqaruv', 'Reklama (Boost)'].map(f => (
                      <Badge key={f} variant="outline" className="text-[10px] bg-background">
                        <Check className="w-2.5 h-2.5 mr-0.5 text-success" />{f}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform phone number - prominent display */}
          <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-4 space-y-3">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                Platformaning Manager raqami
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-background rounded-lg border-2 border-primary/20 px-4 py-3 text-center">
                  <span className="text-lg font-bold font-mono tracking-wider text-foreground">
                    {PLATFORM_MANAGER_PHONE}
                  </span>
                </div>
                <Button 
                  variant={copied ? "default" : "outline"} 
                  size="sm" 
                  onClick={copyPhone}
                  className="h-12 px-4 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Ushbu raqamni Uzum Seller kabinetida <strong>Manager</strong> sifatida qo'shing
              </p>
            </CardContent>
          </Card>

          {/* Steps */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-4">
              <div className="text-xs font-semibold text-foreground">Qadamlar</div>
              <div className="space-y-3">
                {STEPS.map((step, i) => {
                  const isDone = i < currentStep;
                  const isCurrent = i === currentStep;
                  const StepIcon = step.icon;
                  return (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isDone ? 'bg-success text-success-foreground' 
                        : isCurrent ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {isDone ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                      </div>
                      <div className="pt-1">
                        <div className={`text-xs font-medium ${isDone ? 'text-success' : isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{step.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Optional Shop ID */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Store className="w-3 h-3" /> Do'kon ID (ixtiyoriy)
                </Label>
                <Input
                  value={shopId}
                  onChange={e => setShopId(e.target.value)}
                  placeholder="12345 (Uzum Seller kabineti URL-dan)"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Open Uzum Seller link */}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-8 text-xs"
                onClick={() => window.open('https://seller.uzum.uz/seller/settings/employees', '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Uzum Seller — Xodimlar bo'limini ochish
              </Button>

              {/* Confirm button */}
              <Button
                onClick={confirmManagerActive}
                disabled={isSaving}
                className="w-full h-10 text-sm font-medium"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Ha, Manager qo'shildi — Tasdiqlash
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Security footer */}
      <div className="flex items-start gap-2 px-1">
        <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Manager roli faqat <strong>o'qish</strong> huquqini beradi. Do'koningizdagi mahsulotlar va buyurtmalar xavfsiz. 
          Istalgan vaqtda bekor qilishingiz mumkin.
        </p>
      </div>
    </div>
  );
}
