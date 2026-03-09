import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Store, Plus, Pencil, Trash2, Loader2, CheckCircle, XCircle,
  Building2, Percent, AlertTriangle, RefreshCw, Package, ShoppingCart, TrendingUp, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { MarketplaceLogo, MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';

interface StoreInfo {
  id: string;
  marketplace: string;
  storeName: string;
  storeId: string;
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  productsCount: number;
  ordersCount: number;
  totalRevenue: number;
  lastSyncAt: string | null;
  state: string;
}

interface MultiStoreManagerProps {
  connectedMarketplaces: string[];
  onStoreChange?: () => void;
}

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market', uzum: 'Uzum Market', wildberries: 'Wildberries', ozon: 'Ozon',
};

const TAX_OPTIONS = [
  { value: 0, label: 'Soliq yo\'q (0%)' },
  { value: 4, label: 'Soddalashtilgan (4%)' },
  { value: 12, label: 'QQS (12%)' },
  { value: 15, label: 'Foyda solig\'i (15%)' },
  { value: 25, label: 'Yuqori stavka (25%)' },
];

export function MultiStoreManager({ connectedMarketplaces, onStoreChange }: MultiStoreManagerProps) {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editStore, setEditStore] = useState<StoreInfo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formMarketplace, setFormMarketplace] = useState('');
  const [formName, setFormName] = useState('');
  const [formStoreId, setFormStoreId] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formTaxRate, setFormTaxRate] = useState(4);
  const [formActive, setFormActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchStores = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const storeList: StoreInfo[] = (data || []).map(conn => {
        const acct = conn.account_info as any;
        const creds = conn.credentials as any;
        return {
          id: conn.id,
          marketplace: conn.marketplace,
          storeName: acct?.storeName || acct?.campaignName || acct?.shopName || creds?.shopName || MARKETPLACE_NAMES[conn.marketplace] || conn.marketplace,
          storeId: acct?.campaignId || acct?.shopId || creds?.campaignId || creds?.shopId || '',
          taxRate: acct?.taxRate ?? 4,
          isActive: conn.is_active ?? true,
          createdAt: conn.created_at,
          productsCount: conn.products_count || 0,
          ordersCount: conn.orders_count || 0,
          totalRevenue: conn.total_revenue || 0,
          lastSyncAt: conn.last_sync_at,
          state: normalizeState(acct?.state),
        };
      });

      setStores(storeList);
    } catch (e: any) {
      console.error('Fetch stores error:', e);
      toast.error('Do\'konlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  // Sync a single store — fetches fresh data from marketplace API
  const handleSyncStore = async (store: StoreInfo) => {
    setSyncingId(store.id);
    try {
      // Fetch products count
      const [productsResult, ordersResult] = await Promise.all([
        supabase.functions.invoke('fetch-marketplace-data', {
          body: { marketplace: store.marketplace, dataType: 'products', limit: 1, fetchAll: false },
        }),
        supabase.functions.invoke('fetch-marketplace-data', {
          body: { marketplace: store.marketplace, dataType: 'orders', fetchAll: false },
        }),
      ]);

      const productsCount = productsResult.data?.total || productsResult.data?.data?.length || store.productsCount;
      const ordersCount = ordersResult.data?.total || ordersResult.data?.data?.length || store.ordersCount;

      // Update DB
      await supabase
        .from('marketplace_connections')
        .update({
          products_count: productsCount,
          orders_count: ordersCount,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', store.id);

      // Update local state
      setStores(prev => prev.map(s =>
        s.id === store.id
          ? { ...s, productsCount, ordersCount, lastSyncAt: new Date().toISOString() }
          : s
      ));
      toast.success(`${store.storeName} sinxronlandi`);
    } catch (e: any) {
      toast.error(`Sinxronlash xatosi: ${e.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const resetForm = () => {
    setFormMarketplace('');
    setFormName('');
    setFormStoreId('');
    setFormApiKey('');
    setFormTaxRate(4);
    setFormActive(true);
  };

  const handleOpenAdd = () => { resetForm(); setEditStore(null); setAddDialogOpen(true); };

  const handleOpenEdit = (store: StoreInfo) => {
    setEditStore(store);
    setFormMarketplace(store.marketplace);
    setFormName(store.storeName);
    setFormStoreId(store.storeId);
    setFormTaxRate(store.taxRate);
    setFormActive(store.isActive);
    setFormApiKey('');
    setAddDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formMarketplace || !formName.trim()) {
      toast.warning('Marketplace va do\'kon nomini kiriting');
      return;
    }

    setIsSaving(true);
    try {
      if (editStore) {
        const updates: any = {
          is_active: formActive,
          account_info: { shopName: formName, taxRate: formTaxRate, storeName: formName },
        };
        if (formApiKey.trim()) {
          updates.credentials = { apiKey: formApiKey, campaignId: formStoreId, shopId: formStoreId };
        }

        const { error } = await supabase
          .from('marketplace_connections')
          .update(updates)
          .eq('id', editStore.id);

        if (error) throw error;
        toast.success(`"${formName}" yangilandi`);
      } else {
        const { data, error } = await supabase.functions.invoke('connect-marketplace', {
          body: {
            marketplace: formMarketplace,
            apiKey: formApiKey,
            campaignId: formStoreId,
            shopId: formStoreId,
            sellerId: formStoreId,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success(`"${formName}" ulandi — ${data?.connection?.productsCount || 0} ta mahsulot topildi`);
      }

      setAddDialogOpen(false);
      resetForm();
      fetchStores();
      onStoreChange?.();
    } catch (e: any) {
      toast.error(`Xatolik: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (store: StoreInfo) => {
    try {
      const { error } = await supabase
        .from('marketplace_connections')
        .update({ is_active: !store.isActive })
        .eq('id', store.id);

      if (error) throw error;
      setStores(prev => prev.map(s => s.id === store.id ? { ...s, isActive: !s.isActive } : s));
      toast.success(`${store.storeName} ${!store.isActive ? 'faollashtirildi' : 'o\'chirildi'}`);
      onStoreChange?.();
    } catch (e: any) {
      toast.error(`Xatolik: ${e.message}`);
    }
  };

  const handleDelete = async (storeId: string) => {
    try {
      const { error } = await supabase.from('marketplace_connections').delete().eq('id', storeId);
      if (error) throw error;
      setStores(prev => prev.filter(s => s.id !== storeId));
      setDeleteConfirm(null);
      toast.success("Do'kon o'chirildi");
      onStoreChange?.();
    } catch (e: any) {
      toast.error(`Xatolik: ${e.message}`);
    }
  };

  const formatRevenue = (r: number) => {
    if (r >= 1000000) return (r / 1000000).toFixed(1) + 'M';
    if (r >= 1000) return (r / 1000).toFixed(0) + 'K';
    return r.toString();
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Hech qachon';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hozirgina';
    if (mins < 60) return `${mins} min oldin`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} soat oldin`;
    return `${Math.floor(hours / 24)} kun oldin`;
  };

  const activeCount = stores.filter(s => s.isActive).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Do'konlar boshqaruvi
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{activeCount} faol do'kon • Real marketplace ma'lumotlari</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStores} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={handleOpenAdd} className="gap-1">
            <Plus className="h-4 w-4" /> Do'kon qo'shish
          </Button>
        </div>
      </div>

      {/* Store cards */}
      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Do'konlar yo'q</h3>
            <p className="text-muted-foreground mb-4">Marketplace API kalitini kiriting va do'koningizni ulang</p>
            <Button onClick={handleOpenAdd}><Plus className="h-4 w-4 mr-1" /> Do'kon qo'shish</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {stores.map(store => (
            <Card key={store.id} className={`transition-all ${!store.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <MarketplaceLogo marketplace={store.marketplace} size={32} />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{store.storeName}</div>
                      <div className="text-[11px] text-muted-foreground">{MARKETPLACE_NAMES[store.marketplace]}</div>
                    </div>
                  </div>
                  <Switch checked={store.isActive} onCheckedChange={() => handleToggleActive(store)} />
                </div>

                {/* Live stats from API */}
                <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded-lg p-2.5">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <Package className="h-3 w-3" />
                    </div>
                    <div className="text-sm font-semibold">{store.productsCount}</div>
                    <div className="text-[10px] text-muted-foreground">Mahsulot</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <ShoppingCart className="h-3 w-3" />
                    </div>
                    <div className="text-sm font-semibold">{store.ordersCount}</div>
                    <div className="text-[10px] text-muted-foreground">Buyurtma</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                    <div className="text-sm font-semibold">{formatRevenue(store.totalRevenue)}</div>
                    <div className="text-[10px] text-muted-foreground">Daromad</div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {store.storeId && (
                    <Badge variant="outline" className="text-[10px]">ID: {store.storeId}</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    <Percent className="h-3 w-3 mr-0.5" /> {store.taxRate}%
                  </Badge>
                  <Badge variant={store.state === 'CONNECTED' ? 'default' : 'secondary'} className="text-[10px]">
                    {store.state === 'CONNECTED' ? <><CheckCircle className="h-3 w-3 mr-0.5" /> API OK</> : <><XCircle className="h-3 w-3 mr-0.5" /> {store.state}</>}
                  </Badge>
                </div>

                {/* Last sync */}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Oxirgi sinxron: {timeAgo(store.lastSyncAt)}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-7"
                    onClick={() => handleSyncStore(store)} disabled={syncingId === store.id}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${syncingId === store.id ? 'animate-spin' : ''}`} />
                    Sinxron
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => handleOpenEdit(store)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive h-7 px-2"
                    onClick={() => setDeleteConfirm(store.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              {editStore ? "Do'konni tahrirlash" : "Yangi do'kon qo'shish"}
            </DialogTitle>
            <DialogDescription>
              {editStore ? 'Ma\'lumotlarni yangilang' : 'Marketplace API kalitini kiriting — do\'kon ma\'lumotlari avtomatik yuklanadi'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Marketplace</Label>
              <Select value={formMarketplace} onValueChange={setFormMarketplace} disabled={!!editStore}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Marketplace tanlang" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MARKETPLACE_NAMES).map(([key, name]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <MarketplaceLogo marketplace={key} size={16} />
                        {name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Do'kon nomi</Label>
              <Input placeholder="API dan avtomatik olinadi" value={formName}
                onChange={e => setFormName(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                {formMarketplace === 'yandex' ? 'Campaign ID' : formMarketplace === 'uzum' ? 'Shop ID / Seller ID' : 'Do\'kon ID'}
              </Label>
              <Input placeholder="Marketplace'dagi do'kon ID" value={formStoreId}
                onChange={e => setFormStoreId(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">API kalit {editStore && '(bo\'sh qoldiring o\'zgartirmaslik uchun)'}</Label>
              <Input placeholder="API kalit" value={formApiKey}
                onChange={e => setFormApiKey(e.target.value)} type="password" className="h-9" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Soliq stavkasi</Label>
              <Select value={String(formTaxRate)} onValueChange={v => setFormTaxRate(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Faol holati</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Bekor</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editStore ? 'Saqlash' : "Ulash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Do'konni o'chirish
            </DialogTitle>
            <DialogDescription>
              Bu do'konni o'chirsangiz, barcha ulangan ma'lumotlar ham o'chiriladi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Bekor</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              O'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
