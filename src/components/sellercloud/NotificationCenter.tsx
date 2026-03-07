import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Bell, BellRing, Package, ShoppingCart, DollarSign, 
  AlertTriangle, Check, X, Settings, MessageSquare, 
  Link2, Unlink, Copy, ExternalLink, CheckCircle2,
  Loader2, Send, Star, RefreshCw, Zap, Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============== Types ==============

interface NotificationPrefs {
  id?: string;
  user_id: string;
  channel: string;
  notify_new_orders: boolean;
  notify_low_stock: boolean;
  notify_price_changes: boolean;
  notify_reviews: boolean;
  notify_sync_errors: boolean;
  notify_subscription: boolean;
  notify_promotions: boolean;
  is_enabled: boolean;
}

const DEFAULT_PREFS: Omit<NotificationPrefs, 'user_id'> = {
  channel: 'telegram',
  notify_new_orders: true,
  notify_low_stock: true,
  notify_price_changes: false,
  notify_reviews: true,
  notify_sync_errors: true,
  notify_subscription: true,
  notify_promotions: false,
  is_enabled: true,
};

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  order: ShoppingCart,
  stock: Package,
  price: DollarSign,
  sync: Check,
  system: AlertTriangle,
  info: Bell,
  review: Star,
};

const SEVERITY_MAP: Record<string, string> = {
  order: 'success', stock: 'warning', price: 'info',
  sync: 'success', system: 'error', info: 'info', review: 'info',
};

const PREF_ITEMS = [
  { key: 'notify_new_orders', label: 'Yangi buyurtmalar', desc: 'Yangi buyurtma kelganda xabar olish', icon: ShoppingCart },
  { key: 'notify_low_stock', label: 'Kam qoldiq', desc: 'Mahsulot zaxirasi kamaysa ogohlantirish', icon: Package },
  { key: 'notify_price_changes', label: 'Narx o\'zgarishi', desc: 'Raqobatchilar narxi o\'zgarganda', icon: DollarSign },
  { key: 'notify_reviews', label: 'Yangi sharhlar', desc: 'Mijoz sharh yozganda xabar', icon: Star },
  { key: 'notify_sync_errors', label: 'Sinxron xatoliklar', desc: 'Marketplace sinxronlashda xatolik', icon: AlertTriangle },
  { key: 'notify_subscription', label: 'Obuna holati', desc: 'Obuna muddati haqida eslatma', icon: Shield },
  { key: 'notify_promotions', label: 'Aksiyalar', desc: 'Yangi aksiya va takliflar', icon: Zap },
] as const;

const BOT_USERNAME = 'sellercloudx_bot';

// ============== Component ==============

export function NotificationCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('notifications');

  // ---- Notifications list ----
  const { data: notifications = [], isLoading: notifLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // ---- Telegram link status ----
  const { data: telegramLink, isLoading: linkLoading } = useQuery({
    queryKey: ['telegram-link', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('telegram_chat_links')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_admin', false)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // ---- Profile link code ----
  const { data: profile } = useQuery({
    queryKey: ['profile-link-code', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('telegram_link_code, telegram_linked')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // ---- Notification preferences ----
  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ['notification-prefs', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel', 'telegram')
        .maybeSingle();
      return data as NotificationPrefs | null;
    },
    enabled: !!user,
  });

  // ---- Generate link code ----
  const generateLinkCode = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_link_code: code })
        .eq('user_id', user.id);
      if (error) throw error;
      return code;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-link-code'] });
      toast.success('Ulanish kodi yaratildi');
    },
  });

  // ---- Update preferences ----
  const updatePrefs = useMutation({
    mutationFn: async (updates: Partial<NotificationPrefs>) => {
      if (!user) throw new Error('Not authenticated');
      
      if (prefs?.id) {
        const { error } = await supabase
          .from('notification_preferences')
          .update(updates)
          .eq('id', prefs.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_preferences')
          .insert({ user_id: user.id, ...DEFAULT_PREFS, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });

  // ---- Unlink Telegram ----
  const unlinkTelegram = useMutation({
    mutationFn: async () => {
      if (!user || !telegramLink) throw new Error('No link');
      await supabase.from('telegram_chat_links').delete().eq('id', telegramLink.id);
      await supabase.from('profiles').update({ telegram_linked: false, telegram_link_code: null }).eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-link'] });
      queryClient.invalidateQueries({ queryKey: ['profile-link-code'] });
      toast.success('Telegram uzildi');
    },
  });

  // ---- Realtime ----
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // ---- Actions ----
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const copyLinkCode = () => {
    if (profile?.telegram_link_code) {
      navigator.clipboard.writeText(`/link ${profile.telegram_link_code}`);
      toast.success('Buyriq nusxalandi');
    }
  };

  const isLinked = !!telegramLink;
  const currentPrefs = prefs || { ...DEFAULT_PREFS, user_id: user?.id || '' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BellRing className="h-6 w-6 text-primary" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Bildirishnomalar</h2>
            <p className="text-sm text-muted-foreground">
              {isLinked ? '✅ Telegram ulangan' : '⚡ Telegramni ulang — real-time xabarlar oling'}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Xabarlar
            {unreadCount > 0 && <Badge variant="destructive" className="text-[10px] px-1.5">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="telegram" className="gap-2">
            <Send className="h-4 w-4" />
            Telegram
            {isLinked && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Sozlamalar
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: Notifications List ===== */}
        <TabsContent value="notifications" className="space-y-4">
          {unreadCount > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-2" />Barchasini o'qilgan
              </Button>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {notifLoading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="flex gap-4 p-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-16 text-center">
                    <Bell className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">Bildirishnomalar yo'q</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Marketplace hodisalari bu yerda ko'rinadi</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notification: any) => {
                      const notifType = notification.type || 'info';
                      const Icon = NOTIFICATION_ICONS[notifType] || Bell;
                      const severity = SEVERITY_MAP[notifType] || 'info';
                      return (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-muted/50 transition-colors ${!notification.is_read ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                        >
                          <div className="flex gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              severity === 'error' ? 'bg-destructive/10' :
                              severity === 'warning' ? 'bg-yellow-500/10' :
                              severity === 'success' ? 'bg-green-500/10' : 'bg-primary/10'
                            }`}>
                              <Icon className={`h-5 w-5 ${
                                severity === 'error' ? 'text-destructive' :
                                severity === 'warning' ? 'text-yellow-600' :
                                severity === 'success' ? 'text-green-600' : 'text-primary'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-sm text-foreground">{notification.title}</p>
                                  <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {!notification.is_read && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markAsRead(notification.id)}>
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteNotification(notification.id)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="text-[10px]">{notifType}</Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB 2: Telegram Integration ===== */}
        <TabsContent value="telegram" className="space-y-4">
          {/* Link Status Card */}
          <Card className={isLinked ? 'border-green-500/30 bg-green-500/5' : 'border-primary/30 bg-primary/5'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLinked ? 'bg-green-500/20' : 'bg-primary/20'}`}>
                  <Send className={`h-6 w-6 ${isLinked ? 'text-green-600' : 'text-primary'}`} />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {isLinked ? '✅ Telegram ulangan' : '🔗 Telegramni ulash'}
                  </CardTitle>
                  <CardDescription>
                    {isLinked 
                      ? `@${telegramLink?.telegram_username || 'user'} — real-time bildirishnomalar faol`
                      : 'Buyurtmalar, zaxira va boshqa hodisalar haqida Telegramga xabar oling'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLinked ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-background border">
                      <p className="text-xs text-muted-foreground">Username</p>
                      <p className="font-medium text-sm">@{telegramLink?.telegram_username || '—'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background border">
                      <p className="text-xs text-muted-foreground">Holat</p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <p className="font-medium text-sm text-green-600">Faol</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />Botga o'tish
                      </a>
                    </Button>
                    <Button 
                      variant="outline" size="sm" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => unlinkTelegram.mutate()}
                      disabled={unlinkTelegram.isPending}
                    >
                      <Unlink className="h-4 w-4 mr-2" />Uzish
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Step-by-step guide */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
                      <div>
                        <p className="font-medium text-sm">Botga o'ting</p>
                        <Button variant="link" className="p-0 h-auto text-primary" asChild>
                          <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer">
                            t.me/{BOT_USERNAME} <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
                      <div>
                        <p className="font-medium text-sm">/start buyrug'ini yuboring</p>
                        <p className="text-xs text-muted-foreground">Bot avtomatik javob beradi</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
                      <div>
                        <p className="font-medium text-sm">Ulanish kodingizni yuboring</p>
                        {profile?.telegram_link_code ? (
                          <div className="flex items-center gap-2 mt-1.5">
                            <code className="px-3 py-1.5 bg-muted rounded-md text-sm font-mono font-bold">
                              /link {profile.telegram_link_code}
                            </code>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyLinkCode}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" variant="secondary" className="mt-1.5"
                            onClick={() => generateLinkCode.mutate()}
                            disabled={generateLinkCode.isPending}
                          >
                            {generateLinkCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                            Kod yaratish
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <Shield className="h-4 w-4 shrink-0" />
                    Kod bir martalik va faqat sizning akkauntingiz uchun amal qiladi
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* What you'll get */}
          {!isLinked && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Telegramda nima olasiz?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { icon: ShoppingCart, text: 'Yangi buyurtma kelganda darhol xabar' },
                    { icon: Package, text: 'Mahsulot qoldig\'i kamayganda ogohlantirish' },
                    { icon: Star, text: 'Yangi sharh va savollar' },
                    { icon: AlertTriangle, text: 'Sinxronlash xatoliklari haqida xabar' },
                    { icon: DollarSign, text: 'Narx o\'zgarishlari monitoringi' },
                    { icon: Shield, text: 'Obuna muddati haqida eslatma' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <item.icon className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-sm">{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB 3: Settings ===== */}
        <TabsContent value="settings" className="space-y-4">
          {/* Master toggle */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Telegram bildirishnomalar</p>
                    <p className="text-sm text-muted-foreground">
                      {isLinked ? 'Barcha Telegram xabarlarini yoqish/o\'chirish' : 'Avval Telegramni ulang'}
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={currentPrefs.is_enabled}
                  disabled={!isLinked || updatePrefs.isPending}
                  onCheckedChange={(checked) => updatePrefs.mutate({ is_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Individual toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bildirishnoma turlari</CardTitle>
              <CardDescription>Qaysi hodisalar haqida xabar olishni tanlang</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {PREF_ITEMS.map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={(currentPrefs as any)[key] ?? false}
                    disabled={!isLinked || !currentPrefs.is_enabled || updatePrefs.isPending}
                    onCheckedChange={(checked) => updatePrefs.mutate({ [key]: checked })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
