import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign, TrendingUp, TrendingDown, Search, Download,
  ArrowUpDown, Package, AlertTriangle, CheckCircle2, BarChart3
} from 'lucide-react';
import { toDisplayUzs } from '@/lib/currency';
import { isExcludedOrder } from '@/lib/revenueCalculations';
import { useCostPrices } from '@/hooks/useCostPrices';
import { useMarketplaceTariffs, getTariffForProduct } from '@/hooks/useMarketplaceTariffs';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { DateRangeFilter, getPresetDates, type DatePreset } from './DateRangeFilter';
import { MarketplaceLogo } from '@/lib/marketplaceConfig';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

interface SkuMetrics {
  offerId: string;
  name: string;
  marketplace: string;
  photo?: string;
  unitsSold: number;
  revenue: number;
  costPrice: number;
  totalCost: number;
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  grossProfit: number;
  netProfit: number;
  margin: number;
  avgSellingPrice: number;
  fulfillmentBreakdown: { fbo: number; fbs: number };
  hasCostPrice: boolean;
  hasRealTariff: boolean;
}

type SortKey = 'revenue' | 'unitsSold' | 'netProfit' | 'margin' | 'name';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));
const fmtPrice = (n: number) => fmt(n) + " so'm";

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function UnitEconomyDashboard({ connectedMarketplaces, store }: Props) {
  const [selectedMp, setSelectedMp] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(getPresetDates('30d').from);
  const [dateTo, setDateTo] = useState<Date | undefined>(getPresetDates('30d').to);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { getCostPrice } = useCostPrices();
  const { data: tariffMap, isLoading: tariffsLoading } = useMarketplaceTariffs(connectedMarketplaces, store);
  const isLoading = store.isLoadingOrders;
  const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];

  const skuMetrics = useMemo(() => {
    if (isLoading) return [];
    const map = new Map<string, SkuMetrics>();

    for (const mp of mpList) {
      const orders = store.getOrders(mp);
      for (const order of orders) {
        if (isExcludedOrder(order)) continue;
        if (dateFrom || dateTo) {
          const d = new Date(order.createdAt);
          if (dateFrom && d < dateFrom) continue;
          if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); if (d > end) continue; }
        }

        for (const item of (order.items || [])) {
          const key = `${mp}:${(item.offerId || '').toLowerCase()}`;
          const qty = item.count || 1;
          const itemPrice = toDisplayUzs(item.price || 0, mp);
          const itemRevenue = itemPrice * qty;
          const cp = getCostPrice(mp, item.offerId);
          const costUzs = cp !== null ? toDisplayUzs(cp, mp) : 0;
          const totalCostForItem = costUzs * qty;
          const commBase = (item as any).commissionBase ? toDisplayUzs((item as any).commissionBase, mp) : undefined;
          const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice, mp, commBase);
          const commissionForItem = tariff.commission * qty;
          const logisticsForItem = tariff.logistics * qty;
          const withdrawalForItem = (tariff.withdrawal || 0) * qty;
          const feesForItem = tariff.totalFee * qty;
          const ft = (order as any).fulfillmentType;

          if (!map.has(key)) {
            map.set(key, {
              offerId: item.offerId,
              name: item.offerName || item.offerId,
              marketplace: mp,
              photo: item.photo,
              unitsSold: 0, revenue: 0, costPrice: costUzs, totalCost: 0,
              commission: 0, logistics: 0, withdrawal: 0, totalFees: 0,
              grossProfit: 0, netProfit: 0, margin: 0,
              avgSellingPrice: 0,
              fulfillmentBreakdown: { fbo: 0, fbs: 0 },
              hasCostPrice: cp !== null,
              hasRealTariff: tariff.isReal,
            });
          }

          const m = map.get(key)!;
          m.unitsSold += qty;
          m.revenue += itemRevenue;
          m.totalCost += totalCostForItem;
          m.commission += commissionForItem;
          m.logistics += logisticsForItem;
          m.withdrawal += withdrawalForItem;
          m.totalFees += feesForItem;
          if (tariff.isReal) m.hasRealTariff = true;
          if (ft === 'FBO') m.fulfillmentBreakdown.fbo += qty;
          else m.fulfillmentBreakdown.fbs += qty;
        }
      }
    }

    // Calculate derived metrics
    const result: SkuMetrics[] = [];
    map.forEach(m => {
      m.grossProfit = m.revenue - m.totalCost;
      m.netProfit = m.grossProfit - m.totalFees;
      m.margin = m.revenue > 0 ? (m.netProfit / m.revenue) * 100 : 0;
      m.avgSellingPrice = m.unitsSold > 0 ? m.revenue / m.unitsSold : 0;
      result.push(m);
    });

    return result;
  }, [mpList, store.dataVersion, isLoading, getCostPrice, tariffMap, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let arr = skuMetrics;
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(s => s.name.toLowerCase().includes(q) || s.offerId.toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });
    return arr;
  }, [skuMetrics, search, sortBy, sortDir]);

  // Summary stats
  const totals = useMemo(() => {
    const t = { revenue: 0, cost: 0, commission: 0, logistics: 0, withdrawal: 0, fees: 0, profit: 0, units: 0, withCost: 0, total: 0 };
    skuMetrics.forEach(s => {
      t.revenue += s.revenue; t.cost += s.totalCost;
      t.commission += s.commission; t.logistics += s.logistics; t.withdrawal += s.withdrawal;
      t.fees += s.totalFees;
      t.profit += s.netProfit; t.units += s.unitsSold; t.total++;
      if (s.hasCostPrice) t.withCost++;
    });
    return { ...t, margin: t.revenue > 0 ? (t.profit / t.revenue) * 100 : 0 };
  }, [skuMetrics]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const headers = ['Marketplace', 'Artikul', 'Nomi', 'Sotilgan', 'Daromad', 'Tannarx', 'Xarajat', 'Komissiya', 'Logistika', 'Chiqarish', 'Jami hizmatlar', 'Sof foyda', 'Marja %', 'FBO', 'FBS'];
    const rows = filtered.map(s => [
      s.marketplace, s.offerId, `"${s.name}"`, String(s.unitsSold),
      String(Math.round(s.revenue)), String(Math.round(s.costPrice)),
      String(Math.round(s.totalCost)), String(Math.round(s.commission)),
      String(Math.round(s.logistics)), String(Math.round(s.withdrawal)),
      String(Math.round(s.totalFees)),
      String(Math.round(s.netProfit)), s.margin.toFixed(1),
      String(s.fulfillmentBreakdown.fbo), String(s.fulfillmentBreakdown.fbs),
    ]);
    downloadCSV('unit-economy.csv', headers, rows);
  };

  if (connectedMarketplaces.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Avval marketplace ulang</CardContent></Card>;
  }

  if (isLoading || tariffsLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <MarketplaceFilterBar connectedMarketplaces={connectedMarketplaces} selectedMp={selectedMp} onSelect={setSelectedMp} />
        <DateRangeFilter from={dateFrom} to={dateTo} activePreset={datePreset}
          onRangeChange={(f, t, p) => { setDateFrom(f); setDateTo(t); setDatePreset(p); }} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Jami daromad</span></div>
            <p className="text-lg font-bold">{fmtPrice(totals.revenue)}</p>
            <p className="text-xs text-muted-foreground">{fmt(totals.units)} dona sotildi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Jami xarajat</span></div>
            <p className="text-lg font-bold">{fmtPrice(totals.cost + totals.fees)}</p>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div>Tannarx: {fmtPrice(totals.cost)}</div>
              <div>Komissiya: {fmtPrice(totals.commission)}</div>
              <div>Logistika: {fmtPrice(totals.logistics)}</div>
              {totals.withdrawal > 0 && <div>Chiqarish: {fmtPrice(totals.withdrawal)}</div>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              {totals.profit >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
              <span className="text-xs text-muted-foreground">Sof foyda</span>
            </div>
            <p className={`text-lg font-bold ${totals.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmtPrice(totals.profit)}</p>
            <p className="text-xs text-muted-foreground">Marja: {totals.margin.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">SKU'lar</span></div>
            <p className="text-lg font-bold">{totals.total}</p>
            <div className="flex items-center gap-1 mt-1">
              <Progress value={totals.total > 0 ? (totals.withCost / totals.total) * 100 : 0} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">{totals.total > 0 ? Math.round((totals.withCost / totals.total) * 100) : 0}% tannarxli</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Export */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="SKU yoki nomi bo'yicha qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('unitsSold')}>
                  <span className="inline-flex items-center gap-1">Sotilgan <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('revenue')}>
                  <span className="inline-flex items-center gap-1">Daromad <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden lg:table-cell">Komissiya</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden lg:table-cell">Logistika</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden xl:table-cell">Jami hizmat</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('netProfit')}>
                  <span className="inline-flex items-center gap-1">Sof foyda <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('margin')}>
                  <span className="inline-flex items-center gap-1">Marja <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground hidden lg:table-cell">FBO/FBS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(s => (
                <tr key={`${s.marketplace}:${s.offerId}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {s.photo ? (
                        <img src={s.photo} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[200px] lg:max-w-[300px]">{s.name}</p>
                        <div className="flex items-center gap-1.5">
                          <MarketplaceLogo marketplace={s.marketplace} size={12} />
                          <span className="text-[10px] text-muted-foreground">{s.offerId}</span>
                          {!s.hasCostPrice && <span title="Tannarx kiritilmagan"><AlertTriangle className="h-3 w-3 text-amber-500" /></span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3 font-medium">{fmt(s.unitsSold)}</td>
                  <td className="text-right py-2.5 px-3 font-medium">{fmt(s.revenue)}</td>
                  <td className="text-right py-2.5 px-3 hidden lg:table-cell">
                    <span>{fmt(s.commission)}</span>
                  </td>
                  <td className="text-right py-2.5 px-3 hidden lg:table-cell">{fmt(s.logistics)}</td>
                  <td className="text-right py-2.5 px-3 hidden xl:table-cell">
                    <span className="font-medium">{fmt(s.totalFees)}</span>
                    {s.withdrawal > 0 && <div className="text-[9px] text-muted-foreground">+{fmt(s.withdrawal)} chiqarish</div>}
                  </td>
                  <td className={`text-right py-2.5 px-3 font-semibold ${s.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {s.netProfit >= 0 ? '+' : ''}{fmt(s.netProfit)}
                  </td>
                  <td className="text-right py-2.5 px-3">
                    <Badge variant={s.margin >= 20 ? 'default' : s.margin >= 0 ? 'secondary' : 'destructive'} className="text-xs">
                      {s.margin.toFixed(1)}%
                    </Badge>
                  </td>
                  <td className="text-right py-2.5 px-3 hidden lg:table-cell">
                    <div className="flex items-center justify-end gap-1">
                      {s.fulfillmentBreakdown.fbo > 0 && <Badge variant="outline" className="text-[10px] px-1.5">FBO {s.fulfillmentBreakdown.fbo}</Badge>}
                      {s.fulfillmentBreakdown.fbs > 0 && <Badge variant="secondary" className="text-[10px] px-1.5">FBS {s.fulfillmentBreakdown.fbs}</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Ma'lumot topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground text-center">
            Birinchi 100 ta ko'rsatilmoqda (jami: {filtered.length})
          </div>
        )}
      </Card>
    </div>
  );
}
