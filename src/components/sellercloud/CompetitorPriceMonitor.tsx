import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  TrendingDown, TrendingUp, Minus, RefreshCw, Loader2, Search,
  Bell, Zap, BarChart3, Eye, AlertTriangle, ArrowDown, ArrowUp,
  Settings, Plus, Trash2, Target, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { MarketplaceLogo, MARKETPLACE_NAMES } from '@/lib/marketplaceConfig';

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
}

interface CrossListedProduct {
  offerId: string;
  productName: string;
  prices: { marketplace: string; price: number }[];
  minPrice: number;
  maxPrice: number;
  priceDiffPercent: number;
}

interface AutoRepriceRule {
  id: string;
  marketplace: string;
  strategy: string;
  minPricePercent: number;
  maxUndercut: number;
  isActive: boolean;
  productsCount: number;
}

interface CompetitorPriceMonitorProps {
  connectedMarketplaces: string[];
  store: any;
}

export function CompetitorPriceMonitor({ connectedMarketplaces, store }: CompetitorPriceMonitorProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('monitor');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<ProductPriceData[]>([]);
  const [crossListed, setCrossListed] = useState<CrossListedProduct[]>([]);
  const [rules, setRules] = useState<AutoRepriceRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // Rule form
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<AutoRepriceRule | null>(null);
  const [ruleMarketplace, setRuleMarketplace] = useState('');
  const [ruleStrategy, setRuleStrategy] = useState('match_lowest');
  const [ruleMinPercent, setRuleMinPercent] = useState(5);
  const [ruleMaxUndercut, setRuleMaxUndercut] = useState(3);
  const [ruleActive, setRuleActive] = useState(true);

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
            myPrice,
            originalPrice,
            discount,
            stockCount: prod.stockCount ?? prod.stockFBO ?? prod.stockFBS ?? 0,
            category: prod.category || prod.subjectName || '',
            pictures: prod.pictures || [],
          });
        }
      }

      setProducts(allProducts);

      // Find cross-listed products (same offerId across marketplaces)
      const offerMap = new Map<string, { marketplace: string; price: number; name: string }[]>();
      for (const p of allProducts) {
        const key = p.offerId.toLowerCase().replace(/[-_\s]/g, '');
        if (!offerMap.has(key)) offerMap.set(key, []);
        offerMap.get(key)!.push({ marketplace: p.marketplace, price: p.myPrice, name: p.productName });
      }

      const crossListedItems: CrossListedProduct[] = [];
      offerMap.forEach((entries, key) => {
        if (entries.length > 1) {
          const prices = entries.map(e => e.price);
          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          crossListedItems.push({
            offerId: key,
            productName: entries[0].name,
            prices: entries.map(e => ({ marketplace: e.marketplace, price: e.price })),
            minPrice: minP,
            maxPrice: maxP,
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

  // Category price analysis
  const categoryPrices = new Map<string, { total: number; count: number; min: number; max: number }>();
  products.forEach(p => {
    if (!p.category) return;
    const cat = categoryPrices.get(p.category) || { total: 0, count: 0, min: Infinity, max: 0 };
    cat.total += p.myPrice;
    cat.count++;
    cat.min = Math.min(cat.min, p.myPrice);
    cat.max = Math.max(cat.max, p.myPrice);
    categoryPrices.set(p.category, cat);
  });

  const formatPrice = (p: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(p));

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive" className="text-[10px]">Tugagan</Badge>;
    if (stock < 10) return <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-300">Kam: {stock}</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{stock} dona</Badge>;
  };

  const handleSaveRule = () => {
    const newRule: AutoRepriceRule = {
      id: editRule?.id || crypto.randomUUID(),
      marketplace: ruleMarketplace,
      strategy: ruleStrategy,
      minPricePercent: ruleMinPercent,
      maxUndercut: ruleMaxUndercut,
      isActive: ruleActive,
      productsCount: products.filter(p => p.marketplace === ruleMarketplace).length,
    };

    if (editRule) {
      setRules(prev => prev.map(r => r.id === editRule.id ? newRule : r));
    } else {
      setRules(prev => [...prev, newRule]);
    }
    setRuleDialogOpen(false);
    toast.success('Qoida saqlandi');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Narx monitoring va tahlil
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalProducts} mahsulot • {connectedMarketplaces.length} marketplace
          </p>
        </div>
        <Button size="sm" onClick={handleSyncPrices} disabled={isSyncing} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Package} label="Jami mahsulot" value={totalProducts} color="text-primary" />
        <KPICard icon={TrendingDown} label="Chegirmada" value={withDiscount} color="text-emerald-600" />
        <KPICard icon={AlertTriangle} label="Kam qolgan" value={lowStock} color="text-amber-600" />
        <KPICard icon={TrendingUp} label="Tugagan" value={outOfStock} color="text-destructive" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitor">📊 Narxlar</TabsTrigger>
          <TabsTrigger value="cross">🔄 Kross-narx ({crossListed.length})</TabsTrigger>
          <TabsTrigger value="reprice">⚡ Avto-narxlash</TabsTrigger>
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
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Barcha" />
              </SelectTrigger>
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
                          <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 border-emerald-300">
                            -{prod.discount}%
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
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
                Bir necha marketplace'da joylashtirilgan {crossListed.length} ta mahsulotning narx farqi
              </p>
              {crossListed.map(item => (
                <Card key={item.offerId}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.offerId}</p>
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
              <p className="text-xs text-muted-foreground">Narxlarni avtomatik moslashtirish qoidalari</p>
            </div>
            <Button size="sm" onClick={() => { setEditRule(null); setRuleMarketplace(connectedMarketplaces[0] || ''); setRuleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Qoida qo'shish
            </Button>
          </div>

          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h4 className="font-semibold mb-1">Avto-narxlash qoidalari yo'q</h4>
                <p className="text-xs text-muted-foreground mb-3">Qoida qo'shib, narxlarni avtomatik boshqaring</p>
                <Button size="sm" onClick={() => { setEditRule(null); setRuleMarketplace(connectedMarketplaces[0] || ''); setRuleDialogOpen(true); }}>
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
                          <div className="font-medium text-sm">{MARKETPLACE_NAMES[rule.marketplace]}</div>
                          <div className="text-[10px] text-muted-foreground">{rule.productsCount} mahsulot</div>
                        </div>
                      </div>
                      <Switch checked={rule.isActive} onCheckedChange={v => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: v } : r))} />
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>📌 Strategiya: <span className="text-foreground font-medium">{getStrategyLabel(rule.strategy)}</span></div>
                      <div>🛡️ Min narx: <span className="text-foreground font-medium">Tannarxdan -{rule.minPricePercent}%</span></div>
                      <div>⚡ Max pasaytirish: <span className="text-foreground font-medium">{rule.maxUndercut}%</span></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="text-xs h-7 flex-1"
                        onClick={() => { setEditRule(rule); setRuleMarketplace(rule.marketplace); setRuleStrategy(rule.strategy); setRuleMinPercent(rule.minPricePercent); setRuleMaxUndercut(rule.maxUndercut); setRuleActive(rule.isActive); setRuleDialogOpen(true); }}>
                        <Settings className="h-3 w-3 mr-1" /> Sozlash
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive h-7 px-2"
                        onClick={() => setRules(prev => prev.filter(r => r.id !== rule.id))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Avto-narxlash qoidasi</DialogTitle>
            <DialogDescription>Narxlarni avtomatik moslashtirish qoidalarini yarating</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Marketplace</Label>
              <Select value={ruleMarketplace} onValueChange={setRuleMarketplace}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {connectedMarketplaces.map(mp => (
                    <SelectItem key={mp} value={mp}>
                      <div className="flex items-center gap-2"><MarketplaceLogo marketplace={mp} size={16} />{MARKETPLACE_NAMES[mp]}</div>
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
                <Label className="text-xs">Min narx (tannarxdan %)</Label>
                <Input type="number" value={ruleMinPercent} onChange={e => setRuleMinPercent(Number(e.target.value))} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Max pasaytirish (%)</Label>
                <Input type="number" value={ruleMaxUndercut} onChange={e => setRuleMaxUndercut(Number(e.target.value))} className="h-9" />
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
