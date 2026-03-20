import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFeaturePricing, useAdminFeaturePricing, type FeaturePrice } from '@/hooks/useFeaturePricing';
import { useSubscriptionPlans, useAdminSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings2, Zap, DollarSign, Crown, Sparkles,
  Wallet, Users, ArrowUpDown, Search, Plus, Trash2, Store, Image, Copy, Percent, Edit,
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

// ─── Feature Row ───
function FeatureRow({ feature, onUpdate, plans }: { feature: FeaturePrice; onUpdate: (id: string, updates: Partial<FeaturePrice>) => void; plans?: SubscriptionPlan[] }) {
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

  // Check which plans include this feature for free
  const includedInPlans = plans?.filter(p => p.included_feature_keys?.includes(feature.feature_key)) || [];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-sm text-foreground">{feature.feature_name_uz || feature.feature_name}</span>
          {feature.is_free && <Badge variant="secondary" className="text-[10px]">Bepul</Badge>}
          {feature.is_premium_only && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">Premium</Badge>}
          {!feature.is_enabled && <Badge variant="destructive" className="text-[10px]">O'chirilgan</Badge>}
        </div>
        <p className="text-xs text-muted-foreground font-mono">{feature.feature_key}</p>
        {includedInPlans.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {includedInPlans.map(p => (
              <Badge key={p.id} variant="outline" className="text-[9px] px-1.5" style={{ borderColor: p.color || undefined, color: p.color || undefined }}>
                {p.name_uz || p.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground">Yoqiq</Label>
          <Switch checked={feature.is_enabled} onCheckedChange={(v) => onUpdate(feature.id, { is_enabled: v })} />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground">Bepul</Label>
          <Switch checked={feature.is_free} onCheckedChange={(v) => onUpdate(feature.id, { is_free: v })} />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground">Premium</Label>
          <Switch checked={feature.is_premium_only} onCheckedChange={(v) => onUpdate(feature.id, { is_premium_only: v })} />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <div className="space-y-1">
              <Label className="text-[10px]">Narx (UZS)</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-24 h-8 text-xs" type="number" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Limit/oy</Label>
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} className="w-20 h-8 text-xs" type="number" placeholder="∞" />
            </div>
            <Button size="sm" onClick={handleSave} className="h-8 text-xs">Saqlash</Button>
          </>
        ) : (
          <>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">
                {feature.is_free ? 'Bepul' : `${feature.base_price_uzs.toLocaleString()} UZS`}
              </p>
              {feature.elegant_limit && <p className="text-[10px] text-muted-foreground">Limit: {feature.elegant_limit}/oy</p>}
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

// ─── Plan Card (Admin) ───
function PlanCard({ plan, features, onUpdate, onDelete }: {
  plan: SubscriptionPlan;
  features: FeaturePrice[];
  onUpdate: (id: string, updates: Partial<SubscriptionPlan>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name_uz: plan.name_uz || '',
    onetime_price_uzs: plan.onetime_price_uzs,
    monthly_fee_uzs: plan.monthly_fee_uzs,
    max_stores_per_marketplace: plan.max_stores_per_marketplace,
    free_card_creation_monthly: plan.free_card_creation_monthly,
    free_cloning_monthly: plan.free_cloning_monthly,
    balance_discount_percent: plan.balance_discount_percent,
  });
  const [featurePickerOpen, setFeaturePickerOpen] = useState(false);

  const includedKeys = plan.included_feature_keys || [];

  const handleSave = () => {
    onUpdate(plan.id, form);
    setEditing(false);
  };

  const toggleFeature = (key: string) => {
    const newKeys = includedKeys.includes(key)
      ? includedKeys.filter(k => k !== key)
      : [...includedKeys, key];
    onUpdate(plan.id, { included_feature_keys: newKeys });
  };

  return (
    <Card className="border-2" style={{ borderColor: (plan.color || '#e5e7eb') + '40' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (plan.color || '#3b82f6') + '15', color: plan.color || '#3b82f6' }}>
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">{plan.name_uz || plan.name}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono">{plan.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Switch checked={plan.is_active} onCheckedChange={(v) => onUpdate(plan.id, { is_active: v })} />
            <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)} className="h-7 w-7 p-0">
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(plan.id)} className="h-7 w-7 p-0 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[10px]">Nomi (UZ)</Label><Input value={form.name_uz} onChange={e => setForm({ ...form, name_uz: e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Bir martalik narx</Label><Input type="number" value={form.onetime_price_uzs} onChange={e => setForm({ ...form, onetime_price_uzs: +e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Oylik to'lov</Label><Input type="number" value={form.monthly_fee_uzs} onChange={e => setForm({ ...form, monthly_fee_uzs: +e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Do'kon limiti/MP</Label><Input type="number" value={form.max_stores_per_marketplace} onChange={e => setForm({ ...form, max_stores_per_marketplace: +e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Bepul kartochka/oy</Label><Input type="number" value={form.free_card_creation_monthly} onChange={e => setForm({ ...form, free_card_creation_monthly: +e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Bepul klon/oy</Label><Input type="number" value={form.free_cloning_monthly} onChange={e => setForm({ ...form, free_cloning_monthly: +e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Balans chegirmasi %</Label><Input type="number" value={form.balance_discount_percent} onChange={e => setForm({ ...form, balance_discount_percent: +e.target.value })} className="h-8 text-xs" /></div>
            <div className="flex items-end"><Button size="sm" onClick={handleSave} className="h-8 text-xs w-full">Saqlash</Button></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground"><DollarSign className="h-3 w-3" /><span>{plan.onetime_price_uzs.toLocaleString()} so'm</span></div>
            {plan.monthly_fee_uzs > 0 && <div className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-3 w-3" /><span>+{plan.monthly_fee_uzs.toLocaleString()}/oy</span></div>}
            <div className="flex items-center gap-1.5 text-muted-foreground"><Store className="h-3 w-3" /><span>{plan.max_stores_per_marketplace >= 999 ? '∞' : plan.max_stores_per_marketplace} do'kon/MP</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Image className="h-3 w-3" /><span>{plan.free_card_creation_monthly} kartochka/oy</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Copy className="h-3 w-3" /><span>{plan.free_cloning_monthly} klon/oy</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Percent className="h-3 w-3" /><span>{plan.balance_discount_percent}% chegirma</span></div>
          </div>
        )}

        <Separator />

        {/* Included features */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium">Bepul funksiyalar ({includedKeys.length})</p>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setFeaturePickerOpen(!featurePickerOpen)}>
              {featurePickerOpen ? 'Yopish' : 'Tahrirlash'}
            </Button>
          </div>
          {featurePickerOpen ? (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {features.map(f => (
                <label key={f.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs">
                  <input type="checkbox" checked={includedKeys.includes(f.feature_key)} onChange={() => toggleFeature(f.feature_key)} className="rounded" />
                  <span className="truncate">{f.feature_name_uz || f.feature_name}</span>
                  <span className="text-muted-foreground font-mono text-[10px] ml-auto">{f.feature_key}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {includedKeys.length === 0 && <p className="text-[10px] text-muted-foreground">Hech qanday funksiya tanlanmagan</p>}
              {includedKeys.map(key => {
                const f = features.find(ff => ff.feature_key === key);
                return <Badge key={key} variant="secondary" className="text-[9px]">{f?.feature_name_uz || f?.feature_name || key}</Badge>;
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Balance Topup (kept from original) ───
function AdminBalanceTopup({ allBalances }: { allBalances: any[] }) {
  const { addBalanceToUser } = useAdminFeaturePricing();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [search, setSearch] = useState('');

  const { data: allProfiles } = useQuery({
    queryKey: ['admin-all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, phone, email').order('full_name', { ascending: true }).limit(1000);
      return data || [];
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['admin-balance-subs'],
    queryFn: async () => {
      const userIds = allBalances.map(b => b.user_id);
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('sellercloud_subscriptions').select('user_id, plan_type, is_active').in('user_id', userIds);
      return data || [];
    },
    enabled: allBalances.length > 0,
  });

  const getProfile = (uid: string) => allProfiles?.find(p => p.user_id === uid);
  const getSub = (uid: string) => subscriptions?.find(s => s.user_id === uid);
  const selectedProfile = userId ? getProfile(userId) : null;

  const filteredProfiles = userSearch
    ? (allProfiles || []).filter(p => (p.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) || (p.phone || '').includes(userSearch) || (p.email || '').toLowerCase().includes(userSearch.toLowerCase()))
    : (allProfiles || []).slice(0, 50);

  const filteredBalances = search
    ? allBalances.filter(b => { const profile = getProfile(b.user_id); return (profile?.full_name || '').toLowerCase().includes(search.toLowerCase()) || (profile?.phone || '').includes(search); })
    : allBalances;

  const handleTopup = () => {
    if (!userId || !amount) return;
    addBalanceToUser.mutate({ userId, amount: Number(amount), description });
    setAmount('');
    setDescription('');
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Balans to'ldirish</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Label className="text-xs">Foydalanuvchi</Label>
            {selectedProfile ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
                <span className="truncate flex-1 font-medium">{selectedProfile.full_name || selectedProfile.phone || 'Noma\'lum'}</span>
                <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => { setUserId(''); setShowUserPicker(true); }}>✕</Button>
              </div>
            ) : (
              <div>
                <Input value={userSearch} onChange={e => { setUserSearch(e.target.value); setShowUserPicker(true); }} onFocus={() => setShowUserPicker(true)} onBlur={() => setTimeout(() => setShowUserPicker(false), 200)} placeholder="Ism, telefon..." className="h-9 text-sm" />
                {showUserPicker && filteredProfiles.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {filteredProfiles.map(p => (
                      <button key={p.user_id} className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b border-border/30 last:border-0" onMouseDown={e => e.preventDefault()} onClick={() => { setUserId(p.user_id); setUserSearch(''); setShowUserPicker(false); }}>
                        <p className="font-medium truncate">{p.full_name || 'Noma\'lum'}</p>
                        <p className="text-xs text-muted-foreground">{p.phone || p.email || p.user_id.slice(0, 12) + '...'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Summa (UZS)</Label>
            <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="100000" type="number" className="h-9 text-sm" />
            <div className="flex gap-1 mt-1">
              {[300000, 500000, 1000000, 5000000].map(v => (
                <Button key={v} size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => setAmount(String(v))}>
                  {v >= 1000000 ? `${v / 1000000} mln` : `${v / 1000} ming`}
                </Button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs">Izoh</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="To'lov #123" className="h-9 text-sm" /></div>
        </div>
        <Button onClick={handleTopup} disabled={addBalanceToUser.isPending || !userId || !amount} className="w-full sm:w-auto">
          <DollarSign className="h-4 w-4 mr-1" /> Balans to'ldirish
        </Button>

        {allBalances.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-medium">Barcha balanslar</h4>
                <Badge variant="secondary">{allBalances.length}</Badge>
                <Input placeholder="Qidiruv..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs max-w-[200px] ml-auto" />
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredBalances.map((b: any) => {
                  const profile = getProfile(b.user_id);
                  const sub = getSub(b.user_id);
                  const planType = sub?.plan_type?.toLowerCase();
                  return (
                    <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg border text-sm ${userId === b.user_id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{profile?.full_name || 'Noma\'lum'}</p>
                        <p className="text-xs text-muted-foreground">{profile?.phone || b.user_id.slice(0, 12) + '...'}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {planType === 'elegant' && <Badge className="bg-violet-500/10 text-violet-600 border-violet-200 text-[10px] px-1.5">Elegant</Badge>}
                          {planType === 'premium' && <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] px-1.5">Premium</Badge>}
                          {sub?.is_active && <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5">Faol</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">{Number(b.balance_uzs).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UZS</span></p>
                        <p className="text-[10px] text-muted-foreground">+{Number(b.total_deposited).toLocaleString()} / -{Number(b.total_spent).toLocaleString()}</p>
                      </div>
                      <Button size="sm" variant={userId === b.user_id ? 'default' : 'outline'} className="h-7 text-xs ml-2 shrink-0" onClick={() => setUserId(b.user_id)}>
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

// ─── New Plan Dialog ───
function NewPlanDialog({ onCreated }: { onCreated: () => void }) {
  const { createPlan } = useAdminSubscriptionPlans();
  const [form, setForm] = useState({
    slug: '', name: '', name_uz: '', onetime_price_uzs: 0, monthly_fee_uzs: 0,
    max_stores_per_marketplace: 1, free_card_creation_monthly: 0, free_cloning_monthly: 0, balance_discount_percent: 0,
  });

  const handleCreate = () => {
    if (!form.slug || !form.name) { toast.error('Slug va nom kiritish shart'); return; }
    createPlan.mutate(form as any, { onSuccess: onCreated });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Yangi tarif</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Yangi tarif qo'shish</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Slug (unikal)</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="gold" className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Nomi</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Gold" className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Nomi (UZ)</Label><Input value={form.name_uz} onChange={e => setForm({ ...form, name_uz: e.target.value })} placeholder="Oltin" className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Bir martalik narx</Label><Input type="number" value={form.onetime_price_uzs} onChange={e => setForm({ ...form, onetime_price_uzs: +e.target.value })} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Oylik to'lov</Label><Input type="number" value={form.monthly_fee_uzs} onChange={e => setForm({ ...form, monthly_fee_uzs: +e.target.value })} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Do'kon limiti/MP</Label><Input type="number" value={form.max_stores_per_marketplace} onChange={e => setForm({ ...form, max_stores_per_marketplace: +e.target.value })} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Kartochka/oy</Label><Input type="number" value={form.free_card_creation_monthly} onChange={e => setForm({ ...form, free_card_creation_monthly: +e.target.value })} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Klon/oy</Label><Input type="number" value={form.free_cloning_monthly} onChange={e => setForm({ ...form, free_cloning_monthly: +e.target.value })} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Chegirma %</Label><Input type="number" value={form.balance_discount_percent} onChange={e => setForm({ ...form, balance_discount_percent: +e.target.value })} className="h-8 text-xs" /></div>
        </div>
        <Button onClick={handleCreate} disabled={createPlan.isPending} className="w-full mt-2">Qo'shish</Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───
export function FeaturePricingManagement() {
  const { features, isLoading } = useFeaturePricing();
  const { updateFeature, allBalances, loadingBalances } = useAdminFeaturePricing();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { updatePlan, deletePlan } = useAdminSubscriptionPlans();

  const handleUpdate = (id: string, updates: Partial<FeaturePrice>) => {
    updateFeature.mutate({ id, updates });
  };

  if (isLoading || plansLoading) {
    return <div className="text-center py-8 text-muted-foreground">Yuklanmoqda...</div>;
  }

  const categories = [...new Set(features?.map(f => f.category) || [])];
  const paidFeatures = features?.filter(f => !f.is_free) || [];
  const freeFeatures = features?.filter(f => f.is_free) || [];
  const activePlans = plans?.filter(p => p.is_active) || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tariflar</p><p className="text-2xl font-bold mt-1">{activePlans.length}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Funksiyalar</p><p className="text-2xl font-bold mt-1">{features?.length || 0}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pullik</p><p className="text-2xl font-bold mt-1 text-primary">{paidFeatures.length}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bepul</p><p className="text-2xl font-bold mt-1 text-emerald-600">{freeFeatures.length}</p></Card>
        <Card className="p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balanslar</p><p className="text-2xl font-bold mt-1">{allBalances?.length || 0}</p></Card>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans" className="gap-1.5"><Crown className="h-3.5 w-3.5" /> Tariflar</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Funksiya narxlari</TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Balanslar</TabsTrigger>
        </TabsList>

        {/* ─── Plans Tab ─── */}
        <TabsContent value="plans" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Obuna tariflari</h3>
            <NewPlanDialog onCreated={() => {}} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {plans?.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                features={features || []}
                onUpdate={(id, updates) => updatePlan.mutate({ id, updates })}
                onDelete={(id) => {
                  if (confirm('Bu tarifni o\'chirmoqchimisiz?')) deletePlan.mutate(id);
                }}
              />
            ))}
          </div>
        </TabsContent>

        {/* ─── Feature Pricing Tab ─── */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
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
                    <FeatureRow key={feature.id} feature={feature} onUpdate={handleUpdate} plans={plans} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ─── Balances Tab ─── */}
        <TabsContent value="balances" className="mt-4">
          <AdminBalanceTopup allBalances={allBalances || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
