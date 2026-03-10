import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, Bell, BellOff, Package, Search, ShoppingCart,
  TrendingDown, CheckCircle2, Settings2, Download, ArrowUpDown, Truck
} from 'lucide-react';
import { toDisplayUzs, formatUzs } from '@/lib/currency';
import { isExcludedOrder } from '@/lib/revenueCalculations';
import { useCostPrices } from '@/hooks/useCostPrices';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo, MARKETPLACE_SHORT_NAMES } from '@/lib/marketplaceConfig';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface ReorderAlert {
  offerId: string;
  name: string;
  marketplace: string;
  photo?: string;
  currentStock: number;
  stockFBO: number;
  stockFBS: number;
  dailyVelocity: number;
  daysUntilStockout: number;
  suggestedReorder: number;
  reorderCost: number;
  costPrice: number;
  hasCostPrice: boolean;
  last30Sales: number;
  last7Sales: number;
  priority: 'urgent' | 'soon' | 'plan' | 'ok';
}

type SortKey = 'daysUntilStockout' | 'suggestedReorder' | 'reorderCost' | 'name';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));
const fmtPrice = (n: number) => fmt(n) + " so'm";

// Default reorder settings
const DEFAULT_LEAD_DAYS = 7; // Days to receive stock from supplier
const DEFAULT_SAFETY_DAYS = 3; // Safety buffer
const DEFAULT_REORDER_PERIOD = 30; // Stock for 30 days

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function AutoReorderAlerts({ connectedMarketplaces, store }: Props) {
  const [selectedMp, setSelectedMp] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('daysUntilStockout');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [leadDays, setLeadDays] = useState(DEFAULT_LEAD_DAYS);
  const [safetyDays, setSafetyDays] = useState(DEFAULT_SAFETY_DAYS);
  const [reorderPeriod, setReorderPeriod] = useState(DEFAULT_REORDER_PERIOD);
  const [showSettings, setShowSettings] = useState(false);

  const { getCostPrice } = useCostPrices();
  const isLoading = store.isLoadingProducts || store.isLoadingOrders;
  const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];

  const alerts = useMemo(() => {
    if (isLoading) return [];
    const now = Date.now();
    const day7 = now - 7 * 86400000;
    const day30 = now - 30 * 86400000;

    const result: ReorderAlert[] = [];

    for (const mp of mpList) {
      const products = store.getProducts(mp);
      const orders = store.getOrders(mp);

      // Build sales velocity per offerId
      const salesMap = new Map<string, { last7: number; last30: number }>();
      for (const order of orders) {
        if (isExcludedOrder(order)) continue;
        const d = new Date(order.createdAt).getTime();
        for (const item of (order.items || [])) {
          const key = (item.offerId || '').toLowerCase();
          if (!key) continue;
          const existing = salesMap.get(key) || { last7: 0, last30: 0 };
          const qty = item.count || 1;
          if (d >= day7) existing.last7 += qty;
          if (d >= day30) existing.last30 += qty;
          salesMap.set(key, existing);
        }
      }

      for (const product of products) {
        const key = (product.offerId || '').toLowerCase();
        const sales = salesMap.get(key) || { last7: 0, last30: 0 };
        const fbo = product.stockFBO || 0;
        const fbs = product.stockFBS || 0;
        const total = fbo + fbs + (product.stockCount || 0);
        const currentStock = Math.max(total, fbo + fbs);

        // Daily velocity: prefer 7-day if enough data
        const dailyVelocity = sales.last7 >= 3
          ? sales.last7 / 7
          : sales.last30 > 0
            ? sales.last30 / 30
            : 0;

        // Days until stockout
        const daysUntilStockout = dailyVelocity > 0 ? currentStock / dailyVelocity : 999;

        // Suggested reorder quantity
        // Formula: (reorderPeriod + leadDays + safetyDays) * dailyVelocity - currentStock
        const totalDaysNeeded = reorderPeriod + leadDays + safetyDays;
        const suggestedReorder = Math.max(0, Math.ceil(totalDaysNeeded * dailyVelocity - currentStock));

        // Cost price
        const cp = getCostPrice(mp, product.offerId);
        const costUzs = cp !== null ? toDisplayUzs(cp, mp) : 0;
        const reorderCost = suggestedReorder * costUzs;

        // Priority
        let priority: ReorderAlert['priority'] = 'ok';
        if (daysUntilStockout <= leadDays) priority = 'urgent';
        else if (daysUntilStockout <= leadDays + safetyDays + 3) priority = 'soon';
        else if (suggestedReorder > 0) priority = 'plan';

        // Only include products that need attention or have sales
        if (dailyVelocity > 0 || currentStock > 0) {
          result.push({
            offerId: product.offerId,
            name: product.name || product.offerId,
            marketplace: mp,
            photo: product.pictures?.[0],
            currentStock,
            stockFBO: fbo,
            stockFBS: fbs,
            dailyVelocity,
            daysUntilStockout,
            suggestedReorder,
            reorderCost,
            costPrice: costUzs,
            hasCostPrice: cp !== null,
            last30Sales: sales.last30,
            last7Sales: sales.last7,
            priority,
          });
        }
      }
    }

    return result;
  }, [mpList, store.dataVersion, isLoading, getCostPrice, leadDays, safetyDays, reorderPeriod]);

  const filtered = useMemo(() => {
    let arr = alerts;
    if (priorityFilter !== 'all') {
      arr = arr.filter(a => a.priority === priorityFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(a => a.name.toLowerCase().includes(q) || a.offerId.toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });
    return arr;
  }, [alerts, priorityFilter, search, sortBy, sortDir]);

  // Summary stats
  const summary = useMemo(() => {
    const urgent = alerts.filter(a => a.priority === 'urgent').length;
    const soon = alerts.filter(a => a.priority === 'soon').length;
    const plan = alerts.filter(a => a.priority === 'plan').length;
    const totalReorderCost = alerts
      .filter(a => a.priority !== 'ok' && a.hasCostPrice)
      .reduce((s, a) => s + a.reorderCost, 0);
    const totalReorderUnits = alerts
      .filter(a => a.priority !== 'ok')
      .reduce((s, a) => s + a.suggestedReorder, 0);
    return { urgent, soon, plan, totalReorderCost, totalReorderUnits };
  }, [alerts]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir(key === 'name' ? 'asc' : 'asc'); }
  };

  const exportCSV = () => {
    const headers = ['Marketplace', 'Artikul', 'Nomi', 'Joriy zaxira', 'Kunlik sotish', 'Qolgan kunlar', 'Buyurtma kerak', 'Buyurtma narxi', 'Tannarx', 'Ustuvorlik'];
    const rows = filtered.map(a => [
      MARKETPLACE_SHORT_NAMES[a.marketplace] || a.marketplace,
      a.offerId,
      `"${a.name}"`,
      String(a.currentStock),
      a.dailyVelocity.toFixed(1),
      a.daysUntilStockout >= 999 ? '∞' : String(Math.round(a.daysUntilStockout)),
      String(a.suggestedReorder),
      String(Math.round(a.reorderCost)),
      String(Math.round(a.costPrice)),
      a.priority === 'urgent' ? 'Shoshilinch' : a.priority === 'soon' ? 'Yaqinda' : a.priority === 'plan' ? 'Rejalashtirish' : 'OK',
    ]);
    downloadCSV('buyurtma-rejasi.csv', headers, rows);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Badge variant="destructive" className="text-[10px]">🔴 Shoshilinch</Badge>;
      case 'soon': return <Badge className="bg-amber-500 text-white text-[10px]">🟡 Yaqinda</Badge>;
      case 'plan': return <Badge variant="secondary" className="text-[10px]">🔵 Rejalashtirish</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">✅ OK</Badge>;
    }
  };

  if (connectedMarketplaces.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Avval marketplace ulang</CardContent></Card>;
  }

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <MarketplaceFilterBar connectedMarketplaces={connectedMarketplaces} selectedMp={selectedMp} onSelect={setSelectedMp} />
        <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="gap-1">
          <Settings2 className="h-4 w-4" /> Sozlamalar
        </Button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Yetkazish muddati (kun)</label>
                <Input type="number" value={leadDays} onChange={e => setLeadDays(Number(e.target.value) || 7)} className="h-8" />
                <p className="text-[10px] text-muted-foreground mt-1">Ta'minotchidan tovar olish vaqti</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Xavfsizlik zaxirasi (kun)</label>
                <Input type="number" value={safetyDays} onChange={e => setSafetyDays(Number(e.target.value) || 3)} className="h-8" />
                <p className="text-[10px] text-muted-foreground mt-1">Kutilmagan vaziyatlar uchun qo'shimcha</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Buyurtma davri (kun)</label>
                <Input type="number" value={reorderPeriod} onChange={e => setReorderPeriod(Number(e.target.value) || 30)} className="h-8" />
                <p className="text-[10px] text-muted-foreground mt-1">Necha kunlik tovar buyurtma qilish</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setPriorityFilter(priorityFilter === 'urgent' ? 'all' : 'urgent')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Shoshilinch</span></div>
            <p className="text-2xl font-bold text-destructive">{summary.urgent}</p>
            <p className="text-[10px] text-muted-foreground">Zaxira tugaydi ({leadDays} kun)</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-amber-500/50 transition-colors" onClick={() => setPriorityFilter(priorityFilter === 'soon' ? 'all' : 'soon')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Bell className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Yaqinda</span></div>
            <p className="text-2xl font-bold text-amber-600">{summary.soon}</p>
            <p className="text-[10px] text-muted-foreground">{leadDays + safetyDays + 3} kun ichida</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Buyurtma kerak</span></div>
            <p className="text-2xl font-bold">{fmt(summary.totalReorderUnits)} dona</p>
            <p className="text-[10px] text-muted-foreground">{summary.urgent + summary.soon + summary.plan} ta mahsulot</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Truck className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Buyurtma xarajati</span></div>
            <p className="text-lg font-bold">{fmtPrice(summary.totalReorderCost)}</p>
            <p className="text-[10px] text-muted-foreground">Tannarx asosida</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Export */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="SKU yoki nomi..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(['all', 'urgent', 'soon', 'plan'] as const).map(p => (
            <Button key={p} variant={priorityFilter === p ? 'default' : 'outline'} size="sm" onClick={() => setPriorityFilter(p)} className="text-xs">
              {p === 'all' ? 'Hammasi' : p === 'urgent' ? '🔴' : p === 'soon' ? '🟡' : '🔵'}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Mahsulot</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Zaxira</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('daysUntilStockout')}>
                  <span className="inline-flex items-center gap-1">Qolgan kun <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden md:table-cell">Kunlik sotish</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('suggestedReorder')}>
                  <span className="inline-flex items-center gap-1">Buyurtma <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => toggleSort('reorderCost')}>
                  <span className="inline-flex items-center gap-1">Xarajat <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Holat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(a => (
                <tr key={`${a.marketplace}:${a.offerId}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {a.photo ? (
                        <img src={a.photo} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[200px] lg:max-w-[300px]">{a.name}</p>
                        <div className="flex items-center gap-1.5">
                          <MarketplaceLogo marketplace={a.marketplace} size={12} />
                          <span className="text-[10px] text-muted-foreground">{a.offerId}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3">
                    <div className="font-medium">{a.currentStock}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.stockFBO > 0 && <span>FBO:{a.stockFBO}</span>}
                      {a.stockFBO > 0 && a.stockFBS > 0 && ' '}
                      {a.stockFBS > 0 && <span>FBS:{a.stockFBS}</span>}
                    </div>
                  </td>
                  <td className={`text-right py-2.5 px-3 font-semibold ${
                    a.daysUntilStockout <= leadDays ? 'text-destructive' : 
                    a.daysUntilStockout <= leadDays + safetyDays + 3 ? 'text-amber-600' : 'text-foreground'
                  }`}>
                    {a.daysUntilStockout >= 999 ? '∞' : Math.round(a.daysUntilStockout)}
                  </td>
                  <td className="text-right py-2.5 px-3 hidden md:table-cell">
                    <span className="text-muted-foreground">{a.dailyVelocity.toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">/kun</span>
                  </td>
                  <td className="text-right py-2.5 px-3">
                    {a.suggestedReorder > 0 ? (
                      <span className="font-semibold text-primary">{fmt(a.suggestedReorder)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-right py-2.5 px-3 hidden lg:table-cell">
                    {a.hasCostPrice && a.reorderCost > 0 ? (
                      <span>{fmtPrice(a.reorderCost)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-right py-2.5 px-3">{getPriorityBadge(a.priority)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary/50" />
                  <p>Barcha zaxiralar yetarli</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground text-center">
            Birinchi 100 ta (jami: {filtered.length})
          </div>
        )}
      </Card>
    </div>
  );
}
