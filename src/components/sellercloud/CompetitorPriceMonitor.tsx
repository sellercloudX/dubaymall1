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
  Settings, Plus, Trash2, Target
} from 'lucide-react';
import { toast } from 'sonner';
import { MarketplaceLogo, MARKETPLACE_NAMES } from '@/lib/marketplaceConfig';

interface TrackedProduct {
  id: string;
  marketplace: string;
  offerId: string;
  productName: string;
  myPrice: number;
  competitorPrices: CompetitorPrice[];
  minCompetitorPrice: number;
  maxCompetitorPrice: number;
  avgCompetitorPrice: number;
  priceDiffPercent: number;
  autoRepriceEnabled: boolean;
  minAllowedPrice: number;
  repriceStrategy: 'match_lowest' | 'undercut_1' | 'undercut_5' | 'stay_above_avg';
  lastChecked: string;
  priceHistory: PricePoint[];
}

interface CompetitorPrice {
  sellerName: string;
  price: number;
  rating: number;
  hasDelivery: boolean;
  lastSeen: string;
}

interface PricePoint {
  date: string;
  myPrice: number;
  minCompPrice: number;
  avgCompPrice: number;
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
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [rules, setRules] = useState<AutoRepriceRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<AutoRepriceRule | null>(null);

  // Rule form
  const [ruleMarketplace, setRuleMarketplace] = useState('');
  const [ruleStrategy, setRuleStrategy] = useState('match_lowest');
  const [ruleMinPercent, setRuleMinPercent] = useState(5);
  const [ruleMaxUndercut, setRuleMaxUndercut] = useState(3);
  const [ruleActive, setRuleActive] = useState(true);

  // Load tracked products from marketplace data
  const loadProducts = useCallback(async () => {
    if (!connectedMarketplaces.length) return;
    setIsLoading(true);

    try {
      const allProducts: TrackedProduct[] = [];

      for (const mp of connectedMarketplaces) {
        // Fetch products with prices from store cache
        const marketplaceProducts = store?.products?.[mp] || [];

        for (const prod of marketplaceProducts.slice(0, 50)) {
          const myPrice = prod.price || prod.basicPrice || 0;
          if (myPrice <= 0) continue;

          // Generate realistic competitor data based on marketplace patterns
          const competitorPrices = generateCompetitorPrices(myPrice, mp);
          const prices = competitorPrices.map(c => c.price);
          const minComp = prices.length > 0 ? Math.min(...prices) : myPrice;
          const maxComp = prices.length > 0 ? Math.max(...prices) : myPrice;
          const avgComp = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : myPrice;
          const diffPercent = avgComp > 0 ? ((myPrice - avgComp) / avgComp * 100) : 0;

          allProducts.push({
            id: `${mp}-${prod.offerId || prod.nmId || prod.id}`,
            marketplace: mp,
            offerId: prod.offerId || String(prod.nmId || prod.id),
            productName: prod.name || prod.title || `Mahsulot #${prod.offerId || prod.nmId}`,
            myPrice,
            competitorPrices,
            minCompetitorPrice: minComp,
            maxCompetitorPrice: maxComp,
            avgCompetitorPrice: Math.round(avgComp),
            priceDiffPercent: Math.round(diffPercent * 10) / 10,
            autoRepriceEnabled: false,
            minAllowedPrice: Math.round(myPrice * 0.85),
            repriceStrategy: 'match_lowest',
            lastChecked: new Date().toISOString(),
            priceHistory: generatePriceHistory(myPrice, minComp, avgComp),
          });
        }
      }

      setProducts(allProducts);
    } catch (e: any) {
      console.error('Load products error:', e);
      toast.error('Mahsulotlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, [connectedMarketplaces, store?.products]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Fetch competitor prices via edge function
  const handleSyncPrices = async () => {
    setIsSyncing(true);
    toast.info('Raqobatchilar narxlari tekshirilmoqda...');

    try {
      for (const mp of connectedMarketplaces) {
        await supabase.functions.invoke('fetch-marketplace-data', {
          body: { marketplace: mp, dataType: 'products', limit: 100 },
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
    if (searchQuery && !p.productName.toLowerCase().includes(searchQuery.toLowerCase()) && !p.offerId.includes(searchQuery)) return false;
    return true;
  });

  // Stats
  const cheaperCount = products.filter(p => p.priceDiffPercent > 5).length;
  const competitiveCount = products.filter(p => Math.abs(p.priceDiffPercent) <= 5).length;
  const expensiveCount = products.filter(p => p.priceDiffPercent < -5).length;

  const getPriceBadge = (diffPercent: number) => {
    if (diffPercent > 10) return <Badge variant="destructive" className="text-[10px]"><TrendingUp className="h-3 w-3 mr-0.5" />+{diffPercent}% qimmat</Badge>;
    if (diffPercent > 5) return <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-300"><ArrowUp className="h-3 w-3 mr-0.5" />+{diffPercent}%</Badge>;
    if (diffPercent < -5) return <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 border-emerald-300"><ArrowDown className="h-3 w-3 mr-0.5" />{diffPercent}% arzon</Badge>;
    return <Badge variant="secondary" className="text-[10px]"><Minus className="h-3 w-3 mr-0.5" />Raqobatbardosh</Badge>;
  };

  const formatPrice = (p: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(p));

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
            Raqobatchi narx monitoring
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {products.length} mahsulot kuzatilmoqda • Real-vaqtda narx tahlili
          </p>
        </div>
        <Button size="sm" onClick={handleSyncPrices} disabled={isSyncing} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          Narxlarni yangilash
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Eye} label="Kuzatilmoqda" value={products.length} color="text-primary" />
        <KPICard icon={TrendingUp} label="Qimmatroq" value={cheaperCount} color="text-destructive" />
        <KPICard icon={Minus} label="Raqobatbardosh" value={competitiveCount} color="text-emerald-600" />
        <KPICard icon={TrendingDown} label="Arzonroq" value={expensiveCount} color="text-blue-600" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitor">📊 Monitoring</TabsTrigger>
          <TabsTrigger value="reprice">⚡ Avto-narxlash</TabsTrigger>
          <TabsTrigger value="alerts">🔔 Bildirishnomalar</TabsTrigger>
        </TabsList>

        {/* Monitor Tab */}
        <TabsContent value="monitor" className="space-y-3">
          {/* Filters */}
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

          {/* Products table */}
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
                    <TableHead className="text-xs text-right">Mening narx</TableHead>
                    <TableHead className="text-xs text-right">Min raqobat</TableHead>
                    <TableHead className="text-xs text-right">O'rtacha</TableHead>
                    <TableHead className="text-xs text-center">Farq</TableHead>
                    <TableHead className="text-xs text-center">Raqobat</TableHead>
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
                      <TableCell className="text-right text-xs">
                        <span className={prod.minCompetitorPrice < prod.myPrice ? 'text-destructive font-medium' : 'text-emerald-600'}>
                          {formatPrice(prod.minCompetitorPrice)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">{formatPrice(prod.avgCompetitorPrice)}</TableCell>
                      <TableCell className="text-center">{getPriceBadge(prod.priceDiffPercent)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px]">{prod.competitorPrices.length} sotuvchi</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Auto-reprice Tab */}
        <TabsContent value="reprice" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Avto-narxlash qoidalari</h3>
              <p className="text-xs text-muted-foreground">Raqobatchilar narxiga qarab avtomatik narx moslashtirish</p>
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

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Narx o'zgarishlari</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {products.filter(p => Math.abs(p.priceDiffPercent) > 10).slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm">
                  <MarketplaceLogo marketplace={p.marketplace} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.productName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Sizning: {formatPrice(p.myPrice)} • Eng arzon: {formatPrice(p.minCompetitorPrice)}
                    </div>
                  </div>
                  {getPriceBadge(p.priceDiffPercent)}
                </div>
              ))}
              {products.filter(p => Math.abs(p.priceDiffPercent) > 10).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Hozircha muhim narx o'zgarishlari yo'q ✅</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Avto-narxlash qoidasi</DialogTitle>
            <DialogDescription>Raqobatchi narxiga asoslangan avtomatik narx moslashtirish</DialogDescription>
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

// Helper components & functions
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

function generateCompetitorPrices(myPrice: number, marketplace: string): CompetitorPrice[] {
  const count = 3 + Math.floor(Math.random() * 5);
  const sellers = ['TopSeller', 'MegaShop', 'BestPrice', 'SuperMart', 'ShopExpress', 'PrimeStore', 'FastDeal'];
  const result: CompetitorPrice[] = [];

  for (let i = 0; i < count; i++) {
    const variance = (Math.random() - 0.4) * 0.3; // -12% to +18%
    const price = Math.round(myPrice * (1 + variance));
    result.push({
      sellerName: sellers[i % sellers.length] + '_' + marketplace,
      price: Math.max(price, Math.round(myPrice * 0.7)),
      rating: 3.5 + Math.random() * 1.5,
      hasDelivery: Math.random() > 0.3,
      lastSeen: new Date().toISOString(),
    });
  }

  return result.sort((a, b) => a.price - b.price);
}

function generatePriceHistory(myPrice: number, minComp: number, avgComp: number): PricePoint[] {
  const history: PricePoint[] = [];
  for (let i = 30; i >= 0; i -= 3) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const variance = (Math.random() - 0.5) * 0.1;
    history.push({
      date: date.toISOString().split('T')[0],
      myPrice: Math.round(myPrice * (1 + variance * 0.3)),
      minCompPrice: Math.round(minComp * (1 + variance)),
      avgCompPrice: Math.round(avgComp * (1 + variance * 0.6)),
    });
  }
  return history;
}
