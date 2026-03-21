import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Package,
  Download, Search, ArrowUpDown, Loader2, CheckCircle, XCircle,
  Clock, Truck, BarChart3, FileSpreadsheet, Receipt
} from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { DateRangeFilter, getPresetDates, type DatePreset } from './DateRangeFilter';
import { MarketplaceFilterBar } from './MarketplaceFilterBar';
import { MarketplaceLogo, MARKETPLACE_SHORT_NAMES } from '@/lib/marketplaceConfig';
import { toDisplayUzs, formatUzsFull } from '@/lib/currency';
import { getOrderRevenueUzs, isExcludedOrder } from '@/lib/revenueCalculations';
import { getMarketplaceOrderStatusCategory } from '@/lib/marketplaceOrderStatus';
import { useCostPrices } from '@/hooks/useCostPrices';
import { useMarketplaceTariffs, getTariffForProduct } from '@/hooks/useMarketplaceTariffs';
import type { MarketplaceDataStore, MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';

interface SalesDashboardProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

type SortField = 'date' | 'total' | 'profit' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_CATEGORIES = [
  { key: 'all', label: 'Hammasi', icon: ShoppingCart, color: '' },
  { key: 'new', label: 'Yangi', icon: Package, color: 'text-orange-500', statuses: ['NEW', 'PENDING', 'RESERVED', 'UNPAID', 'CREATED', 'STARTED', 'AWAITING_PAYMENT'] },
  { key: 'assembly', label: "Yig'ish", icon: Clock, color: 'text-amber-500', statuses: ['PROCESSING', 'PACKING', 'CONFIRM', 'READY_TO_SHIP', 'ACCEPTED_AT_DP', 'ACCEPTED'] },
  { key: 'active', label: "Yo'lda", icon: Truck, color: 'text-blue-500', statuses: ['DELIVERY', 'DELIVERING', 'PENDING_DELIVERY', 'SHIPPED', 'PICKUP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT'] },
  { key: 'delivered', label: 'Yetkazildi', icon: CheckCircle, color: 'text-emerald-600', statuses: ['DELIVERED', 'COMPLETED'] },
  { key: 'cancelled', label: 'Bekor', icon: XCircle, color: 'text-destructive', statuses: ['CANCELLED', 'CANCELED', 'RETURNED', 'CANCEL', 'PENDING_CANCELLATION', 'REJECTED'] },
];

const formatNum = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));
const fmtPrice = (n: number) => formatNum(n) + " so'm";

const MARKETPLACE_TAX: Record<string, number> = {
  yandex: 0.04,
  uzum: 0.04,
};

interface EnrichedOrder {
  order: MarketplaceOrder;
  marketplace: string;
  totalUzs: number;
  costTotal: number;
  grossProfit: number;
  commission: number;
  logistics: number;
  taxAmount: number;
  netProfit: number;
  margin: number;
  subsidyAmount: number;
  statusCategory: string;
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function SalesDashboard({ connectedMarketplaces, store }: SalesDashboardProps) {
  const [selectedMp, setSelectedMp] = useState<string>(connectedMarketplaces.length > 1 ? 'all' : connectedMarketplaces[0] || '');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(getPresetDates('30d').from);
  const [dateTo, setDateTo] = useState<Date | undefined>(getPresetDates('30d').to);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'all' | 'FBO' | 'FBS'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const { getCostPrice } = useCostPrices();
  const { data: tariffMap, dataUpdatedAt: tariffUpdatedAt } = useMarketplaceTariffs(connectedMarketplaces, store);

  const mpList = selectedMp === 'all' ? connectedMarketplaces : [selectedMp];

  // Enrich orders with financial data
  const enrichedOrders = useMemo(() => {
    const result: EnrichedOrder[] = [];

    for (const mp of mpList) {
      const products = store.getProducts(mp);
      const costMap = new Map<string, number>();
      products.forEach(p => {
        const cp = getCostPrice(mp, p.offerId);
        if (cp !== null) costMap.set(p.offerId.toLowerCase(), toDisplayUzs(cp, mp));
      });

      for (const order of store.getOrders(mp)) {
        const totalUzs = getOrderRevenueUzs(order, mp);
        
        // Calculate cost from items
        let costTotal = 0;
        let itemCount = 0;
        let totalFees = 0;
        (order.items || []).forEach(item => {
          const cpKey = (item.offerId || '').toLowerCase();
          const cp = costMap.get(cpKey) || 0;
          costTotal += cp * (item.count || 1);
          itemCount += item.count || 1;

          // Use real tariffs (same as Finance & ABC Analysis)
          // For Yandex: use commissionBase (pre-subsidy price) for accurate fee calculation
          const itemPrice = toDisplayUzs(item.price || 0, mp);
          const commBase = (item as any).commissionBase ? toDisplayUzs((item as any).commissionBase, mp) : undefined;
          const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice, mp, commBase);
          totalFees += tariff.totalFee * (item.count || 1);
        });

        const commission = totalFees;
        const logistics = 0; // Already included in tariff.totalFee
        const subsidyAmount = 0;
        const taxRate = MARKETPLACE_TAX[mp] ?? 0.04;
        const taxAmount = totalUzs * taxRate;
        
        const grossProfit = totalUzs - costTotal;
        const netProfit = grossProfit - commission - taxAmount + subsidyAmount;
        const margin = totalUzs > 0 ? (netProfit / totalUzs) * 100 : 0;

        const statusCategory = getMarketplaceOrderStatusCategory(order, mp);

        result.push({
          order, marketplace: mp, totalUzs, costTotal, grossProfit,
          commission, logistics, taxAmount, netProfit, margin, subsidyAmount, statusCategory
        });
      }
    }

    return result;
  }, [mpList, store.dataVersion, getCostPrice, tariffUpdatedAt]);

  // Filter by date range — handle ISO strings, numeric timestamps, and invalid dates
  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return enrichedOrders;
    return enrichedOrders.filter(e => {
      try {
        const raw = e.order.createdAt;
        if (!raw) return false; // No date = exclude
        // Parse: try ISO first, then numeric timestamp
        let d: Date;
        if (typeof raw === 'number') {
          d = new Date(raw > 1e12 ? raw : raw * 1000); // ms or s
        } else {
          d = parseISO(raw);
        }
        if (isNaN(d.getTime())) return false; // Invalid date = exclude
        if (dateFrom && d < dateFrom) return false;
        if (dateTo) {
          // Include orders from today: compare end of dateTo day
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (d > endOfDay) return false;
        }
        return true;
      } catch { return false; }
    });
  }, [enrichedOrders, dateFrom, dateTo]);

  // Filter by status
  const statusFiltered = statusFilter === 'all'
    ? dateFiltered
    : dateFiltered.filter(e => e.statusCategory === statusFilter);

  // Filter by fulfillment type (FBO/FBS)
  const fulfillmentFiltered = fulfillmentFilter === 'all'
    ? statusFiltered
    : statusFiltered.filter(e => (e.order as any).fulfillmentType === fulfillmentFilter);

  const statusCountBase = fulfillmentFilter === 'all'
    ? dateFiltered
    : dateFiltered.filter(e => (e.order as any).fulfillmentType === fulfillmentFilter);

  // Filter by search
  const searchFiltered = searchQuery
    ? fulfillmentFiltered.filter(e => {
        const q = searchQuery.toLowerCase();
        return String(e.order.id).includes(q) ||
          (e.order.items || []).some(i => (i.offerName || i.offerId || '').toLowerCase().includes(q));
      })
    : fulfillmentFiltered;

  // Sort
  const sorted = useMemo(() => {
    const arr = [...searchFiltered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime(); break;
        case 'total': cmp = a.totalUzs - b.totalUzs; break;
        case 'profit': cmp = a.netProfit - b.netProfit; break;
        case 'status': cmp = a.statusCategory.localeCompare(b.statusCategory); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [searchFiltered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Aggregated stats
  // Use all non-cancelled orders for revenue (consistent with Financial Dashboard)
  const stats = useMemo(() => {
    const nonCancelled = dateFiltered.filter(e => e.statusCategory !== 'cancelled');
    const delivered = dateFiltered.filter(e => e.statusCategory === 'delivered');
    const cancelled = dateFiltered.filter(e => e.statusCategory === 'cancelled');
    const active = dateFiltered.filter(e => !['delivered', 'cancelled'].includes(e.statusCategory));

    const totalRevenue = nonCancelled.reduce((s, e) => s + e.totalUzs, 0);
    const totalCost = nonCancelled.reduce((s, e) => s + e.costTotal, 0);
    const totalCommission = nonCancelled.reduce((s, e) => s + e.commission, 0);
    const totalLogistics = nonCancelled.reduce((s, e) => s + e.logistics, 0);
    const totalNetProfit = nonCancelled.reduce((s, e) => s + e.netProfit, 0);
    const avgMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

    // FBO/FBS breakdown
    const fboOrders = nonCancelled.filter(e => (e.order as any).fulfillmentType === 'FBO');
    const fbsOrders = nonCancelled.filter(e => (e.order as any).fulfillmentType !== 'FBO');
    const fboRevenue = fboOrders.reduce((s, e) => s + e.totalUzs, 0);
    const fbsRevenue = fbsOrders.reduce((s, e) => s + e.totalUzs, 0);

    return {
      totalOrders: dateFiltered.length,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      activeCount: active.length,
      totalRevenue, totalCost, totalCommission, totalLogistics, totalNetProfit, avgMargin,
      cancelRate: dateFiltered.length > 0 ? (cancelled.length / dateFiltered.length * 100) : 0,
      fboCount: fboOrders.length, fbsCount: fbsOrders.length,
      fboRevenue, fbsRevenue,
    };
  }, [dateFiltered]);

  const handleDateChange = (from: Date | undefined, to: Date | undefined, preset: DatePreset) => {
    setDateFrom(from); setDateTo(to); setDatePreset(preset); setCurrentPage(1);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleExportCSV = () => {
    const headers = [
      'Marketplace', 'Buyurtma ID', 'Sana', 'Holat', 'Mahsulot',
      "To'lov (so'm)", "Tannarx (so'm)", "Komissiya (so'm)", "Logistika (so'm)",
      "Yalpi foyda (so'm)", "Sof foyda (so'm)", 'Marja (%)'
    ];
    const rows = sorted.map(e => [
      MARKETPLACE_SHORT_NAMES[e.marketplace] || e.marketplace,
      String(e.order.id),
      format(new Date(e.order.createdAt), 'dd.MM.yyyy HH:mm'),
      e.order.status,
      `"${(e.order.items || []).map(i => i.offerName || i.offerId).join(', ').replace(/"/g, '""')}"`,
      String(Math.round(e.totalUzs)),
      String(Math.round(e.costTotal)),
      String(Math.round(e.commission)),
      String(Math.round(e.logistics)),
      String(Math.round(e.grossProfit)),
      String(Math.round(e.netProfit)),
      e.margin.toFixed(1) + '%',
    ]);
    downloadCSV(`sotuvlar-hisoboti-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
    toast.success('Hisobot CSV formatda yuklandi');
  };

  const getStatusIcon = (cat: string) => {
    switch (cat) {
      case 'delivered': return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
      case 'cancelled': return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      case 'assembly': return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      case 'new': return <Package className="h-3.5 w-3.5 text-orange-500" />;
      default: return <Truck className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Marketplace ulang</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MarketplaceFilterBar
          connectedMarketplaces={connectedMarketplaces}
          selectedMp={selectedMp}
          onSelect={mp => { setSelectedMp(mp); setCurrentPage(1); }}
          showAll={connectedMarketplaces.length > 1}
        />
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onRangeChange={handleDateChange}
          activePreset={datePreset}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <KPICard icon={<Receipt className="h-4 w-4" />} label="Daromad" value={fmtPrice(stats.totalRevenue)} />
        <KPICard icon={<DollarSign className="h-4 w-4" />} label="Tannarx" value={fmtPrice(stats.totalCost)} variant="neutral" />
        <KPICard icon={<TrendingDown className="h-4 w-4" />} label="Komissiya" value={fmtPrice(stats.totalCommission + stats.totalLogistics)} variant="loss" />
        <KPICard icon={<TrendingUp className="h-4 w-4" />} label="Sof foyda" value={fmtPrice(stats.totalNetProfit)} variant={stats.totalNetProfit >= 0 ? 'profit' : 'loss'} />
        <KPICard icon={<BarChart3 className="h-4 w-4" />} label="Marja" value={stats.avgMargin.toFixed(1) + '%'} variant={stats.avgMargin >= 15 ? 'profit' : stats.avgMargin >= 0 ? 'neutral' : 'loss'} />
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_CATEGORIES.map(cat => {
          const count = cat.key === 'all'
            ? statusCountBase.length
            : statusCountBase.filter(e => e.statusCategory === cat.key).length;
          return (
            <Button key={cat.key} variant={statusFilter === cat.key ? 'default' : 'outline'}
              size="sm" className="h-7 text-[11px] px-2.5 gap-1 rounded-full"
              onClick={() => { setStatusFilter(cat.key); setCurrentPage(1); }}>
              <cat.icon className={`h-3.5 w-3.5 ${cat.color}`} />
              {cat.label}
              {count > 0 && <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 text-[10px] px-1">{count}</Badge>}
            </Button>
          );
        })}
      </div>

      {/* FBO/FBY/FBS Filter + Stats */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {(['all', 'FBO', 'FBS'] as const).map(ft => (
            <Button key={ft} variant={fulfillmentFilter === ft ? 'default' : 'ghost'}
              size="sm" className="h-6 text-[11px] px-2.5 rounded-md"
              onClick={() => { setFulfillmentFilter(ft); setCurrentPage(1); }}>
              {ft === 'all' ? 'Hammasi' : ft === 'FBO' ? 'FBO/FBY' : ft}
              {ft === 'FBO' && stats.fboCount > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{stats.fboCount}</Badge>}
              {ft === 'FBS' && stats.fbsCount > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{stats.fbsCount}</Badge>}
            </Button>
          ))}
        </div>
        {stats.fboCount > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-2">
            <span>FBO/FBY: <strong className="text-foreground">{fmtPrice(stats.fboRevenue)}</strong></span>
            <span>FBS: <strong className="text-foreground">{fmtPrice(stats.fbsRevenue)}</strong></span>
          </div>
        )}
      </div>

      {/* Search + Export */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buyurtma ID yoki mahsulot qidirish..." value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="h-8 pl-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="shrink-0 gap-1">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </Button>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {store.isLoadingOrders ? (
            <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Bu filtrda buyurtmalar topilmadi</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground border-b bg-muted/30 items-center">
                <span className="w-8"></span>
                <SortButton label="Buyurtma" field="date" current={sortField} dir={sortDir} onClick={toggleSort} />
                <span className="w-20 text-right">To'lov</span>
                <span className="w-20 text-right hidden sm:block">Tannarx</span>
                <span className="w-20 text-right hidden md:block">Komissiya</span>
                <SortButton label="Sof foyda" field="profit" current={sortField} dir={sortDir} onClick={toggleSort} className="w-24 text-right" />
                <span className="w-16 text-center">Holat</span>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {paginated.map(e => {
                  const firstItem = e.order.items?.[0];
                  const product = firstItem
                    ? store.getProducts(e.marketplace).find(p => p.offerId.toLowerCase() === (firstItem.offerId || '').toLowerCase())
                    : null;
                  const imgUrl = (firstItem as any)?.photo || product?.pictures?.[0];

                  return (
                    <div key={`${e.marketplace}-${e.order.id}`}
                      className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors text-sm">
                      {/* Logo */}
                      <div className="w-8">
                        <MarketplaceLogo marketplace={e.marketplace} size={18} />
                      </div>
                      {/* Order info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {imgUrl && (
                            <div className="w-7 h-7 rounded bg-muted overflow-hidden shrink-0">
                              <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={ev => (ev.currentTarget.style.display = 'none')} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-xs truncate">
                              {product?.name || firstItem?.offerName || firstItem?.offerId || `#${e.order.id}`}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              <span className="font-mono text-primary/70">#{String(e.order.id)}</span>
                              {' · '}{format(new Date(e.order.createdAt), 'dd.MM.yy HH:mm')}
                              {e.order.items && e.order.items.length > 1 && ` · ${e.order.items.length} ta`}
                              {(e.order as any).fulfillmentType && <Badge variant="outline" className="ml-1 text-[8px] px-1 h-3.5">{(e.order as any).fulfillmentType === 'FBO' && e.marketplace === 'yandex' ? 'FBY' : (e.order as any).fulfillmentType}</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Total */}
                      <div className="w-20 text-right text-xs font-medium">{formatNum(e.totalUzs)}</div>
                      {/* Cost */}
                      <div className="w-20 text-right text-xs text-muted-foreground hidden sm:block">
                        {e.costTotal > 0 ? formatNum(e.costTotal) : '—'}
                      </div>
                      {/* Commission */}
                      <div className="w-20 text-right text-xs text-muted-foreground hidden md:block">
                        -{formatNum(e.commission + e.logistics)}
                      </div>
                      {/* Net Profit */}
                      <div className={`w-24 text-right text-xs font-bold ${e.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {e.netProfit >= 0 ? '+' : ''}{formatNum(e.netProfit)}
                        <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                          ({e.margin.toFixed(0)}%)
                        </span>
                      </div>
                      {/* Status */}
                      <div className="w-16 flex justify-center">
                        {getStatusIcon(e.statusCategory)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer summary + pagination */}
              <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{sorted.length} buyurtma</span>
                  <span className="font-medium">Jami: {fmtPrice(sorted.reduce((s, e) => s + e.totalUzs, 0))}</span>
                  <span className={`font-bold ${sorted.reduce((s, e) => s + e.netProfit, 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    Foyda: {fmtPrice(sorted.reduce((s, e) => s + e.netProfit, 0))}
                  </span>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-xs" disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => p - 1)}>←</Button>
                    <span className="text-muted-foreground">{currentPage}/{totalPages}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}>→</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ icon, label, value, variant = 'neutral' }: { icon: React.ReactNode; label: string; value: string; variant?: 'profit' | 'loss' | 'neutral' }) {
  const colorClass = variant === 'profit' ? 'text-emerald-600' : variant === 'loss' ? 'text-destructive' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
          {icon}
          <span className="text-[10px] sm:text-[11px] font-medium truncate">{label}</span>
        </div>
        <div className={`text-sm sm:text-base lg:text-lg font-bold truncate ${colorClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

const SortButton = React.forwardRef<HTMLButtonElement, {
  label: string; field: SortField; current: SortField; dir: SortDir; onClick: (f: SortField) => void; className?: string;
}>(({ label, field, current, dir, onClick, className = '' }, ref) => (
  <button ref={ref} className={`flex items-center gap-0.5 hover:text-foreground transition-colors ${current === field ? 'text-foreground' : ''} ${className}`}
    onClick={() => onClick(field)}>
    {label}
    {current === field && <ArrowUpDown className="h-3 w-3" />}
  </button>
));
SortButton.displayName = 'SortButton';
