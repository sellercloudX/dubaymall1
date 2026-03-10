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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  TrendingDown, TrendingUp, RefreshCw, Loader2, Search,
  Zap, BarChart3, AlertTriangle,
  Settings, Plus, Trash2, Target, Package, Play, History, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { MarketplaceLogo, MARKETPLACE_NAMES } from '@/lib/marketplaceConfig';
import { toMarketplaceCurrency } from '@/lib/currency';
import { useCostPrices } from '@/hooks/useCostPrices';

interface ProductPriceData {
  id: string;
  marketplace: string;
  offerId: string;
  productName: string;
  myPrice: number;
  originalPrice: number;
  discount: number;
  stockCount: number;
  category: string;
  pictures: string[];
  nmID?: number;
}

interface CrossListedProduct {
  offerId: string;
  productName: string;
  prices: { marketplace: string; price: number; nmID?: number }[];
  minPrice: number;
  maxPrice: number;
  priceDiffPercent: number;
}

interface RepriceRule {
  id: string;
  marketplace: string;
  strategy: string;
  min_price_percent: number;
  max_undercut: number;
  is_active: boolean;
  last_executed_at: string | null;
}

interface RepriceLogEntry {
  id: string;
  marketplace: string;
  offer_id: string;
  product_name: string | null;
  old_price: number;
  new_price: number;
  strategy: string;
  reason: string | null;
  status: string;
  created_at: string;
}

interface CompetitorPriceMonitorProps {
  connectedMarketplaces: string[];
  store: any;
}

export function CompetitorPriceMonitor({ connectedMarketplaces, store }: CompetitorPriceMonitorProps) {
  const { user } = useAuth();
  const { costPrices } = useCostPrices();
  const [activeTab, setActiveTab] = useState('monitor');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<ProductPriceData[]>([]);
  const [crossListed, setCrossListed] = useState<CrossListedProduct[]>([]);
  const [rules, setRules] = useState<RepriceRule[]>([]);
  const [logs, setLogs] = useState<RepriceLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Rule form
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<RepriceRule | null>(null);
  const [ruleMarketplace, setRuleMarketplace] = useState('');
  const [ruleStrategy, setRuleStrategy] = useState('match_lowest');
  const [ruleMinPercent, setRuleMinPercent] = useState(5);
  const [ruleMaxUndercut, setRuleMaxUndercut] = useState(3);
  const [ruleActive, setRuleActive] = useState(true);

  // Load rules from DB
  const loadRules = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('repricing_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setRules(data as RepriceRule[]);
  }, [user]);

  // Load logs from DB
  const loadLogs = useCallback(async () => {
    if (!user) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from('repricing_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setLogs(data as RepriceLogEntry[]);
    setLogsLoading(false);
  }, [user]);

  // Load real product data from store
  const loadProducts = useCallback(async () => {
    if (!connectedMarketplaces.length) return;
    setIsLoading(true);
    try {
      const allProducts: ProductPriceData[] = [];
      for (const mp of connectedMarketplaces) {
        const marketplaceProducts = store?.products?.[mp] || [];
        for (const prod of marketplaceProducts) {
          const myPrice = prod.price || prod.basicPrice || 0;
          if (myPrice <= 0) continue;
          const originalPrice = prod.originalPrice || prod.basicPrice || myPrice;
          const discount = originalPrice > myPrice
            ? Math.round((1 - myPrice / originalPrice) * 100)
            : (prod.discount || 0);
          allProducts.push({
            id: `${mp}-${prod.offerId || prod.nmId || prod.id}`,
            marketplace: mp,
            offerId: prod.offerId || String(prod.nmId || prod.id),
            productName: prod.name || prod.title || `Mahsulot #${prod.offerId || prod.nmId}`,
            myPrice, originalPrice, discount,
            stockCount: prod.stockCount ?? prod.stockFBO ?? prod.stockFBS ?? 0,
            category: prod.category || prod.subjectName || '',
            pictures: prod.pictures || [],
            nmID: prod.nmId || prod.nmID,
          });
        }
      }
      setProducts(allProducts);

      // Find cross-listed products (same offerId across marketplaces)
      const offerMap = new Map<string, { marketplace: string; price: number; name: string; nmID?: number }[]>();
      for (const p of allProducts) {
        const key = p.offerId.toLowerCase().replace(/[-_\s]/g, '');
        if (!offerMap.has(key)) offerMap.set(key, []);
        offerMap.get(key)!.push({ marketplace: p.marketplace, price: p.myPrice, name: p.productName, nmID: p.nmID });
      }

      const crossListedItems: CrossListedProduct[] = [];
      offerMap.forEach((entries) => {
        if (entries.length > 1) {
          const prices = entries.map(e => e.price);
          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          crossListedItems.push({
            offerId: entries[0].name,
            productName: entries[0].name,
            prices: entries.map(e => ({ marketplace: e.marketplace, price: e.price, nmID: e.nmID })),
            minPrice: minP, maxPrice: maxP,
            priceDiffPercent: minP > 0 ? Math.round((maxP - minP) / minP * 100) : 0,
          });
        }
      });
      setCrossListed(crossListedItems.sort((a, b) => b.priceDiffPercent - a.priceDiffPercent));
    } catch (e: any) {
      console.error('Load products error:', e);
      toast.error('Mahsulotlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, [connectedMarketplaces, store?.products]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadRules(); }, [loadRules]);

  // Sync fresh data from marketplace APIs
  const handleSyncPrices = async () => {
    setIsSyncing(true);
    toast.info('Marketplace narxlari yangilanmoqda...');
    try {
      for (const mp of connectedMarketplaces) {
        await supabase.functions.invoke('fetch-marketplace-data', {
          body: { marketplace: mp, dataType: 'products', limit: 200 },
        });
      }
      await loadProducts();
      toast.success('Narxlar yangilandi');
    } catch (e: any) {
      toast.error(`Xatolik: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save rule to DB
  const handleSaveRule = async () => {
    if (!user) return;
    const ruleData = {
      user_id: user.id,
      marketplace: ruleMarketplace,
      strategy: ruleStrategy,
      min_price_percent: ruleMinPercent,
      max_undercut: ruleMaxUndercut,
      is_active: ruleActive,
    };

    if (editRule) {
      const { error } = await supabase
        .from('repricing_rules')
        .update(ruleData)
        .eq('id', editRule.id);
      if (error) { toast.error('Qoidani saqlashda xato'); return; }
    } else {
      const { error } = await supabase
        .from('repricing_rules')
        .insert(ruleData);
      if (error) { toast.error('Qoidani yaratishda xato'); return; }
    }
    setRuleDialogOpen(false);
    toast.success('Qoida saqlandi');
    loadRules();
  };

  const handleDeleteRule = async (ruleId: string) => {
    await supabase.from('repricing_rules').delete().eq('id', ruleId);
    toast.success('Qoida o\'chirildi');
    loadRules();
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    await supabase.from('repricing_rules').update({ is_active: isActive }).eq('id', ruleId);
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: isActive } : r));
  };

  // ==========================================
  // EXECUTE AUTO-REPRICING
  // ==========================================
  const executeRepricing = async (rule: RepriceRule) => {
    if (!user) return;
    setIsExecuting(true);
    const toastId = toast.loading(`${MARKETPLACE_NAMES[rule.marketplace] || rule.marketplace}: Narxlar hisoblanmoqda...`);

    try {
      // Get products for this marketplace
      const mpProducts = products.filter(p => p.marketplace === rule.marketplace);
      if (mpProducts.length === 0) {
        toast.dismiss(toastId);
        toast.info('Bu marketplace uchun mahsulotlar topilmadi');
        setIsExecuting(false);
        return;
      }

      // Build cross-marketplace price map
      const offerPriceMap = new Map<string, { marketplace: string; price: number }[]>();
      for (const p of products) {
        const key = p.offerId.toLowerCase().replace(/[-_\s]/g, '');
        if (!offerPriceMap.has(key)) offerPriceMap.set(key, []);
        offerPriceMap.get(key)!.push({ marketplace: p.marketplace, price: p.myPrice });
      }

      // Get cost prices for min-price protection
      const costMap = new Map<string, number>();
      costPrices.forEach(cp => {
        costMap.set(`${cp.marketplace}-${cp.offer_id}`, cp.cost_price);
      });

      const pricesToUpdate: { offerId: string; price: number; nmID?: number }[] = [];
      const logEntries: Array<{
        user_id: string; rule_id: string; marketplace: string; offer_id: string;
        product_name: string; old_price: number; new_price: number; strategy: string;
        reason: string; status: string;
      }> = [];

      for (const prod of mpProducts) {
        const key = prod.offerId.toLowerCase().replace(/[-_\s]/g, '');
        const allPrices = offerPriceMap.get(key) || [];
        const otherPrices = allPrices.filter(p => p.marketplace !== rule.marketplace).map(p => p.price);

        // If no cross-listed products, skip
        if (otherPrices.length === 0) continue;

        const lowestOther = Math.min(...otherPrices);
        const avgOther = otherPrices.reduce((s, p) => s + p, 0) / otherPrices.length;

        // Calculate target price based on strategy
        let targetPrice: number;
        let reason: string;

        switch (rule.strategy) {
          case 'match_lowest':
            targetPrice = lowestOther;
            reason = `Eng arzon narxga teng: ${formatPrice(lowestOther)}`;
            break;
          case 'undercut_1':
            targetPrice = Math.round(lowestOther * 0.99);
            reason = `Eng arzondan 1% past: ${formatPrice(lowestOther)} → ${formatPrice(targetPrice)}`;
            break;
          case 'undercut_5':
            targetPrice = Math.round(lowestOther * 0.95);
            reason = `Eng arzondan 5% past: ${formatPrice(lowestOther)} → ${formatPrice(targetPrice)}`;
            break;
          case 'stay_above_avg':
            targetPrice = Math.round(avgOther * 1.02);
            reason = `O'rtachadan 2% yuqori: ${formatPrice(avgOther)} → ${formatPrice(targetPrice)}`;
            break;
          default:
            targetPrice = lowestOther;
            reason = 'Noma\'lum strategiya';
        }

        // MIN PRICE PROTECTION: don't go below cost + min margin
        const costPrice = costMap.get(`${rule.marketplace}-${prod.offerId}`);
        if (costPrice && costPrice > 0) {
          const minAllowed = Math.round(costPrice * (1 + rule.min_price_percent / 100));
          if (targetPrice < minAllowed) {
            targetPrice = minAllowed;
            reason += ` | Min himoya: ${formatPrice(minAllowed)} (tannarx: ${formatPrice(costPrice)})`;
          }
        }

        // MAX UNDERCUT PROTECTION: don't decrease more than X% from current price
        const maxDrop = Math.round(prod.myPrice * (1 - rule.max_undercut / 100));
        if (targetPrice < maxDrop) {
          targetPrice = maxDrop;
          reason += ` | Max pasaytirish: ${rule.max_undercut}%`;
        }

        // Only update if price actually changed (>1% diff)
        const diff = Math.abs(targetPrice - prod.myPrice) / prod.myPrice;
        if (diff < 0.01) continue;

        pricesToUpdate.push({
          offerId: prod.offerId,
          price: toMarketplaceCurrency(targetPrice, rule.marketplace),
          nmID: prod.nmID,
        });

        logEntries.push({
          user_id: user.id,
          rule_id: rule.id,
          marketplace: rule.marketplace,
          offer_id: prod.offerId,
          product_name: prod.productName,
          old_price: prod.myPrice,
          new_price: targetPrice,
          strategy: rule.strategy,
          reason,
          status: 'pending',
        });
      }

      if (pricesToUpdate.length === 0) {
        toast.dismiss(toastId);
        toast.info('Narx o\'zgartirish kerak emas — barcha narxlar mos');
        setIsExecuting(false);
        return;
      }

      // Send price update to marketplace API
      toast.loading(`${pricesToUpdate.length} ta mahsulot narxi yangilanmoqda...`, { id: toastId });

      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: {
          marketplace: rule.marketplace,
          dataType: 'update-prices',
          offers: pricesToUpdate,
        },
      });

      const finalStatus = (!error && data?.success) ? 'applied' : 'failed';

      // Log all entries
      const finalEntries = logEntries.map(e => ({ ...e, status: finalStatus }));
      await supabase.from('repricing_log').insert(finalEntries);

      // Update rule last_executed_at
      await supabase.from('repricing_rules')
        .update({ last_executed_at: new Date().toISOString() })
        .eq('id', rule.id);

      toast.dismiss(toastId);
      if (finalStatus === 'applied') {
        toast.success(`✅ ${pricesToUpdate.length} ta mahsulot narxi yangilandi!`);
        if (data?.quarantineCount > 0) {
          toast.warning(`${data.quarantineCount} ta mahsulot karantinga tushdi`, { duration: 10000 });
        }
      } else {
        toast.error(`Narx yangilashda xato: ${data?.error || error?.message}`);
      }

      loadRules();
      loadLogs();
      loadProducts();
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(`Xatolik: ${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Execute ALL active rules
  const executeAllRules = async () => {
    const activeRules = rules.filter(r => r.is_active);
    if (activeRules.length === 0) { toast.info('Faol qoidalar yo\'q'); return; }
    for (const rule of activeRules) {
      await executeRepricing(rule);
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    if (selectedMarketplace !== 'all' && p.marketplace !== selectedMarketplace) return false;
    if (searchQuery && !p.productName.toLowerCase().includes(searchQuery.toLowerCase()) && !p.offerId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalProducts = products.length;
  const withDiscount = products.filter(p => p.discount > 0).length;
  const lowStock = products.filter(p => p.stockCount > 0 && p.stockCount < 10).length;
  const outOfStock = products.filter(p => p.stockCount === 0).length;

  const formatPrice = (p: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(p));

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive" className="text-[10px]">Tugagan</Badge>;
    if (stock < 10) return <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-300">Kam: {stock}</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{stock} dona</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Narx monitoring va avto-narxlash
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalProducts} mahsulot • {crossListed.length} kross-listed • {rules.filter(r => r.is_active).length} faol qoida
          </p>
        </div>
        <div className="flex gap-2">
          {rules.filter(r => r.is_active).length > 0 && (
            <Button size="sm" onClick={executeAllRules} disabled={isExecuting} className="gap-1.5" variant="default">
              <Play className={`h-4 w-4 ${isExecuting ? 'animate-pulse' : ''}`} />
              Hammasini bajar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleSyncPrices} disabled={isSyncing} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Yangilash
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Package} label="Jami mahsulot" value={totalProducts} color="text-primary" />
        <KPICard icon={TrendingDown} label="Chegirmada" value={withDiscount} color="text-emerald-600" />
        <KPICard icon={AlertTriangle} label="Kam qolgan" value={lowStock} color="text-amber-600" />
        <KPICard icon={TrendingUp} label="Tugagan" value={outOfStock} color="text-destructive" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v === 'log') loadLogs(); }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monitor">📊 Narxlar</TabsTrigger>
          <TabsTrigger value="cross">🔄 Kross ({crossListed.length})</TabsTrigger>
          <TabsTrigger value="reprice">⚡ Qoidalar</TabsTrigger>
          <TabsTrigger value="log">📋 Tarix</TabsTrigger>
        </TabsList>

        {/* Monitor Tab */}
        <TabsContent value="monitor" className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Mahsulot qidirish..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Select value={selectedMarketplace} onValueChange={setSelectedMarketplace}>
              <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue placeholder="Barcha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha marketplace</SelectItem>
                {connectedMarketplaces.map(mp => (
                  <SelectItem key={mp} value={mp}>
                    <div className="flex items-center gap-2">
                      <MarketplaceLogo marketplace={mp} size={14} />
                      {MARKETPLACE_NAMES[mp] || mp}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
          ) : filteredProducts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Mahsulotlar topilmadi</CardContent></Card>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[50px]">MP</TableHead>
                    <TableHead className="text-xs min-w-[200px]">Mahsulot</TableHead>
                    <TableHead className="text-xs text-right">Narx</TableHead>
                    <TableHead className="text-xs text-right">Asl narx</TableHead>
                    <TableHead className="text-xs text-center">Chegirma</TableHead>
                    <TableHead className="text-xs text-center">Qoldiq</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.slice(0, 100).map(prod => (
                    <TableRow key={prod.id} className="text-sm">
                      <TableCell><MarketplaceLogo marketplace={prod.marketplace} size={20} /></TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium text-xs truncate max-w-[250px]">{prod.productName}</div>
                          <div className="text-[10px] text-muted-foreground">{prod.offerId}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">{formatPrice(prod.myPrice)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {prod.originalPrice !== prod.myPrice ? formatPrice(prod.originalPrice) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {prod.discount > 0 ? (
                          <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 border-emerald-300">-{prod.discount}%</Badge>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">{getStockBadge(prod.stockCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Cross-listed products Tab */}
        <TabsContent value="cross" className="space-y-3">
          {crossListed.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h4 className="font-semibold mb-1">Kross-marketplace mahsulotlar topilmadi</h4>
                <p className="text-xs text-muted-foreground">Bir xil offerId bilan bir necha marketplace'da joylashtirilgan mahsulotlar bo'lsa, narx taqqoslash ko'rsatiladi</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {crossListed.length} ta mahsulot bir necha marketplace'da joylashtirilgan — narx farqi ko'rsatilmoqda
              </p>
              {crossListed.map((item, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium">{item.productName}</p>
                      </div>
                      {item.priceDiffPercent > 0 && (
                        <Badge variant={item.priceDiffPercent > 15 ? 'destructive' : 'secondary'} className="text-[10px]">
                          {item.priceDiffPercent}% farq
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {item.prices.map(p => (
                        <div key={p.marketplace} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50">
                          <MarketplaceLogo marketplace={p.marketplace} size={16} />
                          <span className={`text-xs font-medium ${p.price === item.minPrice ? 'text-emerald-600' : p.price === item.maxPrice ? 'text-destructive' : ''}`}>
                            {formatPrice(p.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Auto-reprice Tab */}
        <TabsContent value="reprice" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Avto-narxlash qoidalari</h3>
              <p className="text-xs text-muted-foreground">Kross-marketplace narxlarni avtomatik moslashtirish</p>
            </div>
            <Button size="sm" onClick={() => {
              setEditRule(null);
              setRuleMarketplace(connectedMarketplaces[0] || '');
              setRuleStrategy('match_lowest');
              setRuleMinPercent(5);
              setRuleMaxUndercut(3);
              setRuleActive(true);
              setRuleDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-1" /> Qoida qo'shish
            </Button>
          </div>

          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h4 className="font-semibold mb-1">Avto-narxlash qoidalari yo'q</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Qoida yarating va kross-marketplace narxlarni avtomatik moslashtiring. 
                  Tannarxdan past tushmaslik kafolati bilan.
                </p>
                <Button size="sm" onClick={() => {
                  setEditRule(null);
                  setRuleMarketplace(connectedMarketplaces[0] || '');
                  setRuleDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" /> Qoida yaratish
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rules.map(rule => (
                <Card key={rule.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MarketplaceLogo marketplace={rule.marketplace} size={24} />
                        <div>
                          <div className="font-medium text-sm">{MARKETPLACE_NAMES[rule.marketplace] || rule.marketplace}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {products.filter(p => p.marketplace === rule.marketplace).length} mahsulot
                          </div>
                        </div>
                      </div>
                      <Switch checked={rule.is_active} onCheckedChange={v => handleToggleRule(rule.id, v)} />
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>📌 Strategiya: <span className="text-foreground font-medium">{getStrategyLabel(rule.strategy)}</span></div>
                      <div>🛡️ Min narx: <span className="text-foreground font-medium">Tannarxdan +{rule.min_price_percent}%</span></div>
                      <div>⚡ Max pasaytirish: <span className="text-foreground font-medium">{rule.max_undercut}%</span></div>
                      {rule.last_executed_at && (
                        <div>🕐 Oxirgi bajarilish: <span className="text-foreground font-medium">
                          {new Date(rule.last_executed_at).toLocaleString('uz-UZ')}
                        </span></div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="default" size="sm" className="text-xs h-7 flex-1"
                        onClick={() => executeRepricing(rule)} disabled={isExecuting || !rule.is_active}>
                        <Play className="h-3 w-3 mr-1" /> Bajarish
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7 px-2"
                        onClick={() => {
                          setEditRule(rule);
                          setRuleMarketplace(rule.marketplace);
                          setRuleStrategy(rule.strategy);
                          setRuleMinPercent(rule.min_price_percent);
                          setRuleMaxUndercut(rule.max_undercut);
                          setRuleActive(rule.is_active);
                          setRuleDialogOpen(true);
                        }}>
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive h-7 px-2"
                        onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Log Tab */}
        <TabsContent value="log" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Narx o'zgartirish tarixi
            </h3>
            <Button size="sm" variant="ghost" onClick={loadLogs} disabled={logsLoading}>
              <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {logsLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : logs.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Hali narx o'zgartirish amalga oshirilmagan</CardContent></Card>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">MP</TableHead>
                    <TableHead className="text-xs">Mahsulot</TableHead>
                    <TableHead className="text-xs text-right">Eski narx</TableHead>
                    <TableHead className="text-xs text-right">Yangi narx</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs">Sabab</TableHead>
                    <TableHead className="text-xs">Vaqt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell><MarketplaceLogo marketplace={log.marketplace} size={16} /></TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate">{log.product_name || log.offer_id}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(log.old_price)}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={log.new_price < log.old_price ? 'text-emerald-600' : 'text-amber-600'}>
                          {formatPrice(log.new_price)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {log.status === 'applied' ? (
                          <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">✓</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[9px]">✗</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-muted-foreground">{log.reason || '—'}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Avto-narxlash qoidasi</DialogTitle>
            <DialogDescription>
              Kross-marketplace narxlarni taqqoslash va avtomatik moslashtirish. 
              Tannarxdan past tushmasligi kafolatlanadi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Marketplace</Label>
              <Select value={ruleMarketplace} onValueChange={setRuleMarketplace}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {connectedMarketplaces.map(mp => (
                    <SelectItem key={mp} value={mp}>
                      <div className="flex items-center gap-2"><MarketplaceLogo marketplace={mp} size={16} />{MARKETPLACE_NAMES[mp] || mp}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Strategiya</Label>
              <Select value={ruleStrategy} onValueChange={setRuleStrategy}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="match_lowest">Eng arzon narxga teng</SelectItem>
                  <SelectItem value="undercut_1">Eng arzondan 1% past</SelectItem>
                  <SelectItem value="undercut_5">Eng arzondan 5% past</SelectItem>
                  <SelectItem value="stay_above_avg">O'rtachadan yuqori</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Min narx (tannarxdan +%)</Label>
                <Input type="number" value={ruleMinPercent} onChange={e => setRuleMinPercent(Number(e.target.value))} className="h-9" />
                <p className="text-[10px] text-muted-foreground">Narx tannarxdan +{ruleMinPercent}% pastga tushmasin</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Max pasaytirish (%)</Label>
                <Input type="number" value={ruleMaxUndercut} onChange={e => setRuleMaxUndercut(Number(e.target.value))} className="h-9" />
                <p className="text-[10px] text-muted-foreground">Joriy narxdan max {ruleMaxUndercut}% pastga tushsin</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Faol</Label>
              <Switch checked={ruleActive} onCheckedChange={setRuleActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Bekor</Button>
            <Button onClick={handleSaveRule}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper components
function KPICard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStrategyLabel(s: string) {
  const map: Record<string, string> = {
    match_lowest: 'Eng arzon narxga teng',
    undercut_1: 'Eng arzondan 1% past',
    undercut_5: 'Eng arzondan 5% past',
    stay_above_avg: 'O\'rtachadan yuqori',
  };
  return map[s] || s;
}
