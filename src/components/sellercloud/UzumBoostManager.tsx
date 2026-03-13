import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Zap, ZapOff, DollarSign, TrendingUp, RefreshCw, Loader2,
  AlertTriangle, Search, ArrowUpRight, BarChart3,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface BoostProduct {
  id: string;
  title: string;
  sku: string;
  price: number;
  boost_active: boolean;
  boost_budget: number;
}

export default function UzumBoostManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<BoostProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('uzum_products')
        .select('id, title, sku, price, boost_active, boost_budget')
        .eq('user_id', user.id)
        .order('boost_active', { ascending: false });

      if (error) throw error;
      setProducts((data || []) as BoostProduct[]);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const toggleBoost = async (product: BoostProduct) => {
    if (!user) return;
    setTogglingId(product.id);
    const newState = !product.boost_active;

    try {
      // Update local product
      const { error: updateErr } = await supabase
        .from('uzum_products')
        .update({
          boost_active: newState,
          boost_started_at: newState ? new Date().toISOString() : null,
          boost_ended_at: newState ? null : new Date().toISOString(),
        } as any)
        .eq('id', product.id);

      if (updateErr) throw updateErr;

      // Send command to extension
      const { data: account } = await supabase
        .from('uzum_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (account) {
        await supabase.from('uzum_extension_commands').insert({
          user_id: user.id,
          uzum_account_id: account.id,
          command_type: 'toggle_boost',
          payload: {
            productId: product.id,
            sku: product.sku,
            title: product.title,
            action: newState ? 'enable' : 'disable',
            budget: product.boost_budget,
          },
          status: 'pending',
        } as any);
      }

      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, boost_active: newState } : p));
      toast({
        title: newState ? 'Boost yoqildi' : 'Boost o\'chirildi',
        description: `"${product.title}" uchun boost ${newState ? 'faollashtirildi' : 'to\'xtatildi'}`,
      });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  const updateBudget = async (productId: string, budget: number) => {
    try {
      await supabase
        .from('uzum_products')
        .update({ boost_budget: budget } as any)
        .eq('id', productId);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, boost_budget: budget } : p));
    } catch (err) {
      console.error('Budget update failed:', err);
    }
  };

  const filtered = products.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = products.filter(p => p.boost_active).length;
  const totalBudget = products.filter(p => p.boost_active).reduce((s, p) => s + (p.boost_budget || 0), 0);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-warning" />
            <div className="text-base font-bold text-foreground">{activeCount}</div>
            <div className="text-[10px] text-muted-foreground">Aktiv boost</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-base font-bold text-foreground">{totalBudget.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">Jami byudjet</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <BarChart3 className="w-5 h-5 mx-auto mb-1 text-accent" />
            <div className="text-base font-bold text-foreground">{products.length}</div>
            <div className="text-[10px] text-muted-foreground">Jami tovarlar</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mahsulotni qidirish..." className="h-8 text-xs pl-7" />
        </div>
        <Button variant="outline" size="sm" onClick={loadProducts} disabled={isLoading} className="h-8">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Info */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-muted-foreground">
            Boost boshqaruvi Chrome Extension orqali ishlaydi. Toggle qilganingizda buyruq Extension'ga yuboriladi va Uzum kabinetida avtomatik boost yoqiladi/o'chiriladi.
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            Boost boshqaruvi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ZapOff className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{products.length === 0 ? 'Hali mahsulotlar yo\'q' : 'Qidiruv natijasi topilmadi'}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filtered.map(product => (
                <div
                  key={product.id}
                  className={`p-3 rounded-lg border text-xs transition-colors ${
                    product.boost_active ? 'border-warning/30 bg-warning/5' : 'border-border/50 bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{product.title}</div>
                      <div className="text-[10px] text-muted-foreground">SKU: {product.sku || '—'} · {product.price?.toLocaleString()} so'm</div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {togglingId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <Switch
                          checked={product.boost_active}
                          onCheckedChange={() => toggleBoost(product)}
                        />
                      )}
                    </div>
                  </div>
                  {product.boost_active && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Byudjet:</Label>
                      <Input
                        type="number"
                        value={product.boost_budget}
                        onChange={e => updateBudget(product.id, Number(e.target.value))}
                        className="h-6 text-[10px] w-24"
                        min={0}
                      />
                      <span className="text-[10px] text-muted-foreground">so'm/kun</span>
                      <Badge variant="secondary" className="text-[9px] h-4 ml-auto">
                        <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />
                        Aktiv
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
