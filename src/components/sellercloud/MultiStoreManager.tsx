import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Building2, Percent, AlertTriangle, RefreshCw
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
  credentials?: any;
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
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_connections')
        .select('id, marketplace, credentials, account_info, is_active, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const storeList: StoreInfo[] = (data || []).map(conn => {
        const acct = conn.account_info as any;
        const creds = conn.credentials as any;
        return {
          id: conn.id,
          marketplace: conn.marketplace,
          storeName: acct?.shopName || acct?.name || creds?.shopName || `${MARKETPLACE_NAMES[conn.marketplace]} do'kon`,
          storeId: creds?.campaignId || creds?.shopId || creds?.businessId || '',
          taxRate: acct?.taxRate ?? 4,
          isActive: conn.is_active ?? true,
          createdAt: conn.created_at,
        };
      });

      setStores(storeList);
    } catch (e: any) {
      console.error('Fetch stores error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchStores(); }, []);

  const resetForm = () => {
    setFormMarketplace('');
    setFormName('');
    setFormStoreId('');
    setFormApiKey('');
    setFormTaxRate(4);
    setFormActive(true);
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditStore(null);
    setAddDialogOpen(true);
  };

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
        // Update existing
        const updates: any = {
          is_active: formActive,
          account_info: { shopName: formName, taxRate: formTaxRate },
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
        // Add new store — use connect-marketplace function
        const { data, error } = await supabase.functions.invoke('connect-marketplace', {
          body: {
            marketplace: formMarketplace,
            credentials: {
              apiKey: formApiKey,
              campaignId: formStoreId,
              shopId: formStoreId,
              shopName: formName,
            },
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success(`"${formName}" qo'shildi`);
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
      const { error } = await supabase
        .from('marketplace_connections')
        .delete()
        .eq('id', storeId);

      if (error) throw error;
      setStores(prev => prev.filter(s => s.id !== storeId));
      setDeleteConfirm(null);
      toast.success("Do'kon o'chirildi");
      onStoreChange?.();
    } catch (e: any) {
      toast.error(`Xatolik: ${e.message}`);
    }
  };

  const activeCount = stores.filter(s => s.isActive).length;
  const maxStores = 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Do'konlar boshqaruvi
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{activeCount}/{maxStores} faol do'kon</p>
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
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MarketplaceLogo marketplace={store.marketplace} size={28} />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{store.storeName}</div>
                      <div className="text-[11px] text-muted-foreground">{MARKETPLACE_NAMES[store.marketplace]}</div>
                    </div>
                  </div>
                  <Switch checked={store.isActive} onCheckedChange={() => handleToggleActive(store)} />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {store.storeId && (
                    <Badge variant="outline" className="text-[10px]">ID: {store.storeId}</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    <Percent className="h-3 w-3 mr-0.5" /> Soliq: {store.taxRate}%
                  </Badge>
                  <Badge variant={store.isActive ? 'default' : 'secondary'} className="text-[10px]">
                    {store.isActive ? <><CheckCircle className="h-3 w-3 mr-0.5" /> Faol</> : <><XCircle className="h-3 w-3 mr-0.5" /> Nofoal</>}
                  </Badge>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => handleOpenEdit(store)}>
                    <Pencil className="h-3 w-3 mr-1" /> Tahrirlash
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
              Marketplace API kaliti va do'kon ma'lumotlarini kiriting
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
              <Input placeholder="Masalan: Mening do'konim" value={formName}
                onChange={e => setFormName(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Do'kon ID (Campaign/Shop ID)</Label>
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
              {editStore ? 'Saqlash' : "Qo'shish"}
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
              Bu do'konni o'chirsangiz, barcha ulangan ma'lumotlar ham o'chiriladi. Bu amalni qaytarib bo'lmaydi.
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
