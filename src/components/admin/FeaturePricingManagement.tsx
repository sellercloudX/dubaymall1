import { useState } from 'react';
import { useFeaturePricing, useAdminFeaturePricing, type FeaturePrice } from '@/hooks/useFeaturePricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings2, Zap, DollarSign, Crown, Sparkles,
  Wallet, Users, ArrowUpDown, Search,
} from 'lucide-react';
import { toast } from 'sonner';

const categoryLabels: Record<string, { label: string; icon: React.ElementType }> = {
  card_creation: { label: '📦 Kartochka yaratish', icon: Sparkles },
  cloning: { label: '🔄 Klonlash', icon: ArrowUpDown },
  ai_tools: { label: '🤖 AI Asboblar', icon: Settings2 },
  pricing: { label: '💰 Narx boshqarish', icon: DollarSign },
  sync: { label: '🔗 Sinxronizatsiya', icon: ArrowUpDown },
  analytics: { label: '📊 Analitika', icon: Zap },
  management: { label: '⚙️ Boshqaruv', icon: Users },
  activation: { label: '🔑 Aktivatsiya', icon: Crown },
};

function FeatureRow({ feature, onUpdate }: { feature: FeaturePrice; onUpdate: (id: string, updates: Partial<FeaturePrice>) => void }) {
  const [price, setPrice] = useState(feature.base_price_uzs.toString());
  const [limit, setLimit] = useState(feature.elegant_limit?.toString() || '');
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onUpdate(feature.id, {
      base_price_uzs: Number(price) || 0,
      elegant_limit: limit ? Number(limit) : null,
    });
    setEditing(false);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-foreground">{feature.feature_name_uz || feature.feature_name}</span>
          {feature.is_free && <Badge variant="secondary" className="text-[10px]">Bepul</Badge>}
          {feature.is_premium_only && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">Premium</Badge>}
          {!feature.is_enabled && <Badge variant="destructive" className="text-[10px]">O'chirilgan</Badge>}
        </div>
        <p className="text-xs text-muted-foreground font-mono">{feature.feature_key}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Toggle enabled */}
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground">Yoqiq</Label>
          <Switch
            checked={feature.is_enabled}
            onCheckedChange={(v) => onUpdate(feature.id, { is_enabled: v })}
          />
        </div>

        {/* Toggle free */}
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground">Bepul</Label>
          <Switch
            checked={feature.is_free}
            onCheckedChange={(v) => onUpdate(feature.id, { is_free: v })}
          />
        </div>

        {/* Toggle premium only */}
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground">Premium</Label>
          <Switch
            checked={feature.is_premium_only}
            onCheckedChange={(v) => onUpdate(feature.id, { is_premium_only: v })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <div className="space-y-1">
              <Label className="text-[10px]">Narx (UZS)</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-24 h-8 text-xs"
                type="number"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Elegant limit</Label>
              <Input
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-20 h-8 text-xs"
                type="number"
                placeholder="∞"
              />
            </div>
            <Button size="sm" onClick={handleSave} className="h-8 text-xs">Saqlash</Button>
          </>
        ) : (
          <>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">
                {feature.is_free ? 'Bepul' : `${feature.base_price_uzs.toLocaleString()} UZS`}
              </p>
              {feature.elegant_limit && (
                <p className="text-[10px] text-muted-foreground">Elegant: {feature.elegant_limit}/oy</p>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-8 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function AdminBalanceTopup({ allBalances }: { allBalances: any[] }) {
  const { addBalanceToUser } = useAdminFeaturePricing();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');

  // Fetch profiles to show names
  const { data: profiles } = useQuery({
    queryKey: ['admin-balance-profiles'],
    queryFn: async () => {
      const userIds = allBalances.map(b => b.user_id);
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', userIds);
      return data || [];
    },
    enabled: allBalances.length > 0,
  });

  // Fetch subscriptions to show plan type
  const { data: subscriptions } = useQuery({
    queryKey: ['admin-balance-subs'],
    queryFn: async () => {
      const userIds = allBalances.map(b => b.user_id);
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from('sellercloud_subscriptions')
        .select('user_id, plan_type, is_active')
        .in('user_id', userIds);
      return data || [];
    },
    enabled: allBalances.length > 0,
  });

  const getProfile = (uid: string) => profiles?.find(p => p.user_id === uid);
  const getSub = (uid: string) => subscriptions?.find(s => s.user_id === uid);

  const handleTopup = () => {
    if (!userId || !amount) return;
    addBalanceToUser.mutate({ userId, amount: Number(amount), description });
    setAmount('');
    setDescription('');
  };

  const filteredBalances = search
    ? allBalances.filter(b => {
        const profile = getProfile(b.user_id);
        return (profile?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (profile?.phone || '').includes(search) ||
          b.user_id.includes(search);
      })
    : allBalances;

  const selectedProfile = userId ? getProfile(userId) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Balans to'ldirish
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Foydalanuvchi</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user UUID yoki ro'yxatdan tanlang"
              className="h-9 text-sm"
            />
            {selectedProfile && (
              <p className="text-xs text-primary mt-1">✓ {selectedProfile.full_name || selectedProfile.phone || 'Noma\'lum'}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Summa (UZS)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
              type="number"
              className="h-9 text-sm"
            />
            <div className="flex gap-1 mt-1">
              {[300000, 500000, 1000000, 5000000].map(v => (
                <Button key={v} size="sm" variant="ghost" className="h-5 text-[10px] px-1.5"
                  onClick={() => setAmount(String(v))}>
                  {v >= 1000000 ? `${v / 1000000} mln` : `${v / 1000} ming`}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Izoh</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="To'lov #123"
              className="h-9 text-sm"
            />
          </div>
        </div>
        <Button onClick={handleTopup} disabled={addBalanceToUser.isPending || !userId || !amount} className="w-full sm:w-auto">
          <DollarSign className="h-4 w-4 mr-1" /> Balans to'ldirish
        </Button>

        {allBalances && allBalances.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-medium">Barcha balanslar</h4>
                <Badge variant="secondary">{allBalances.length}</Badge>
                <Input
                  placeholder="Ism yoki telefon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 text-xs max-w-[200px] ml-auto"
                />
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredBalances.map((b: any) => {
                  const profile = getProfile(b.user_id);
                  const sub = getSub(b.user_id);
                  const planType = sub?.plan_type?.toLowerCase();
                  return (
                    <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg border text-sm ${userId === b.user_id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {profile?.full_name || 'Noma\'lum'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {profile?.phone || b.user_id.slice(0, 12) + '...'}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {planType === 'elegant' && (
                            <Badge className="bg-violet-500/10 text-violet-600 border-violet-200 text-[10px] px-1.5">Elegant</Badge>
                          )}
                          {planType === 'premium' && (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] px-1.5">Premium</Badge>
                          )}
                          {planType === 'pro' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">Free</Badge>
                          )}
                          {sub?.is_active && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5">Faol</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">{Number(b.balance_uzs).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UZS</span></p>
                        <p className="text-[10px] text-muted-foreground">
                          +{Number(b.total_deposited).toLocaleString()} / -{Number(b.total_spent).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={userId === b.user_id ? 'default' : 'outline'}
                        className="h-7 text-xs ml-2 shrink-0"
                        onClick={() => setUserId(b.user_id)}
                      >
                        {userId === b.user_id ? '✓' : 'Tanlash'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function FeaturePricingManagement() {
  const { features, isLoading } = useFeaturePricing();
  const { updateFeature, allBalances, loadingBalances } = useAdminFeaturePricing();

  const handleUpdate = (id: string, updates: Partial<FeaturePrice>) => {
    updateFeature.mutate({ id, updates });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Yuklanmoqda...</div>;
  }

  const categories = [...new Set(features?.map(f => f.category) || [])];
  const paidFeatures = features?.filter(f => !f.is_free) || [];
  const freeFeatures = features?.filter(f => f.is_free) || [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Jami funksiyalar</p>
          <p className="text-2xl font-bold mt-1">{features?.length || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pullik</p>
          <p className="text-2xl font-bold mt-1 text-primary">{paidFeatures.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bepul</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{freeFeatures.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Foydalanuvchi balanslari</p>
          <p className="text-2xl font-bold mt-1">{allBalances?.length || 0}</p>
        </Card>
      </div>

      <Tabs defaultValue="pricing">
        <TabsList>
          <TabsTrigger value="pricing" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Narxlar
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Balanslar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-4 mt-4">
          {/* Tier explanation */}
          <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="secondary">Free (99k/oy)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">1 kun sinov, keyin 99,000 so'm/oy aktivatsiya. Balansdan to'liq narxda</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Premium 1,270,000/oy</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Aktivatsiya bepul, pullik funksiyalardan 40% chegirma</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className="bg-violet-500/10 text-violet-600 border-violet-200">Elegant 6,400,000/oy</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Barcha funksiyalar 0 so'm, oylik limitlar bilan</p>
              </div>
            </div>
          </Card>

          {categories.map(cat => {
            const catInfo = categoryLabels[cat] || { label: cat, icon: Zap };
            const catFeatures = features?.filter(f => f.category === cat) || [];
            const CatIcon = catInfo.icon;

            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CatIcon className="h-4 w-4" /> {catInfo.label}
                    <Badge variant="outline" className="text-[10px]">{catFeatures.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {catFeatures.map(feature => (
                    <FeatureRow key={feature.id} feature={feature} onUpdate={handleUpdate} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="balances" className="mt-4">
          <AdminBalanceTopup allBalances={allBalances || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
