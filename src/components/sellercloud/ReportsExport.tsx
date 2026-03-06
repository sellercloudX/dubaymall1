import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  FileSpreadsheet, Download, Calendar as CalendarIcon, 
  BarChart3, Package, ShoppingCart, DollarSign, TrendingUp, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { toDisplayUzs } from '@/lib/currency';

interface ReportsExportProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const REPORT_TYPES = [
  { id: 'sales', name: 'Sotuvlar hisoboti', description: 'Batafsil sotuvlar: mahsulot nomi, soni, narxi, foyda', icon: DollarSign, formats: ['csv'] },
  { id: 'products', name: 'Mahsulotlar hisoboti', description: 'Mahsulotlar, zaxiralar, narxlar, tannarx, foyda', icon: Package, formats: ['csv'] },
  { id: 'orders', name: 'Buyurtmalar hisoboti', description: 'Buyurtmalar batafsil: mahsulotlar, statuslar, summalar', icon: ShoppingCart, formats: ['csv'] },
  { id: 'inventory', name: 'Zaxira hisoboti', description: 'FBO/FBS zaxiralar, kamayish ogohlantirishi', icon: BarChart3, formats: ['csv'] },
  { id: 'pnl', name: 'Foyda-Zarar (P&L)', description: 'Daromad, tannarx, komissiya, sof foyda', icon: TrendingUp, formats: ['csv'] },
];

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market', uzum: 'Uzum Market', wildberries: 'WB', ozon: 'Ozon', all: 'Barcha marketplacelar',
};

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsExport({ connectedMarketplaces, store }: ReportsExportProps) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);

  const marketplacesToUse = selectedMarketplace === 'all' ? connectedMarketplaces : [selectedMarketplace];

  const stats = useMemo(() => {
    let totalSales = 0, totalOrders = 0, totalProducts = 0;
    for (const mp of marketplacesToUse) {
      const products = store.getProducts(mp);
      const orders = store.getOrders(mp);
      totalProducts += products.length;
      totalOrders += orders.length;
      totalSales += orders.reduce((sum, o) => sum + (o.totalUZS || o.total || 0), 0);
    }
    return { totalSales, totalOrders, avgCheck: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0, totalProducts };
  }, [marketplacesToUse, store.dataVersion]);

  const handleGenerateReport = async (reportId: string) => {
    // Check if data is loaded
    let hasData = false;
    for (const mp of marketplacesToUse) {
      if (store.getProducts(mp).length > 0 || store.getOrders(mp).length > 0) {
        hasData = true;
        break;
      }
    }
    if (!hasData) {
      toast.error('Ma\'lumotlar hali yuklanmagan. Marketplace ma\'lumotlari yuklanishini kuting.');
      return;
    }
    setIsGenerating(true);
    try {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      
      if (reportId === 'products') {
        const headers = ['Marketplace', 'Nomi', 'Offer ID', 'SKU', 'Narxi (so\'m)', 'Tannarxi', 'FBO', 'FBS', 'Jami zaxira', 'Kategoriya', 'Holat', 'Rasm URL'];
        const rows: string[][] = [];
        for (const mp of marketplacesToUse) {
          for (const p of store.getProducts(mp)) {
            const total = (p.stockFBO || 0) + (p.stockFBS || 0);
            rows.push([
              mp,
              `"${(p.name || '').replace(/"/g, '""')}"`,
              p.offerId,
              p.shopSku || '',
              String(toDisplayUzs(p.price || 0, mp)),
              String(p.costPrice || ''),
              String(p.stockFBO || 0),
              String(p.stockFBS || 0),
              String(total),
              `"${(p.category || '').replace(/"/g, '""')}"`,
              p.availability || (total > 0 ? 'active' : 'inactive'),
              p.pictures?.[0] || p.photo || '',
            ]);
          }
        }
        downloadCSV(`mahsulotlar-${dateStr}.csv`, headers, rows);
      } else if (reportId === 'orders' || reportId === 'sales') {
        const headers = [
          'Marketplace', 'Buyurtma ID', 'Sana', 'Holat', 'Xaridor/Hudud',
          'Mahsulot nomi', 'Offer ID', 'Soni', 'Narxi (so\'m)', 'Summa (so\'m)',
          'Yetkazish (so\'m)', 'Jami (so\'m)'
        ];
        const rows: string[][] = [];
        for (const mp of marketplacesToUse) {
          for (const o of store.getOrders(mp)) {
            const buyer = o.buyer?.firstName ? `${o.buyer.firstName} ${o.buyer.lastName || ''}`.trim() : (o.region || '');
            if (o.items && o.items.length > 0) {
              for (const item of o.items) {
                rows.push([
                  mp, String(o.id), o.createdAt, o.status, `"${buyer}"`,
                  `"${(item.name || item.offerName || item.offerId || '').replace(/"/g, '""')}"`,
                  item.offerId || '',
                  String(item.count || 1),
                  String(toDisplayUzs(item.price || 0, mp)),
                  String(toDisplayUzs((item.price || 0) * (item.count || 1), mp)),
                  String(toDisplayUzs(o.deliveryTotal || 0, mp)),
                  String(toDisplayUzs(o.total || 0, mp)),
                ]);
              }
            } else {
              rows.push([
                mp, String(o.id), o.createdAt, o.status, `"${buyer}"`,
                '', '', '', '',
                String(toDisplayUzs(o.itemsTotal || 0, mp)),
                String(toDisplayUzs(o.deliveryTotal || 0, mp)),
                String(toDisplayUzs(o.total || 0, mp)),
              ]);
            }
          }
        }
        downloadCSV(`${reportId === 'sales' ? 'sotuvlar' : 'buyurtmalar'}-${dateStr}.csv`, headers, rows);
      } else if (reportId === 'inventory') {
        const headers = ['Marketplace', 'Nomi', 'SKU', 'Offer ID', 'FBO', 'FBS', 'Jami', 'Narxi (so\'m)', 'Zaxira qiymati (so\'m)', 'Holat'];
        const rows: string[][] = [];
        for (const mp of marketplacesToUse) {
          for (const p of store.getProducts(mp)) {
            const total = (p.stockFBO || 0) + (p.stockFBS || 0);
            const stockValue = total * toDisplayUzs(p.price || 0, mp);
            const status = total === 0 ? 'Tugagan ❌' : total < 5 ? 'Kritik ⚠️' : total < 20 ? 'Kam' : 'Yetarli ✅';
            rows.push([
              mp,
              `"${(p.name || '').replace(/"/g, '""')}"`,
              p.shopSku || p.offerId,
              p.offerId,
              String(p.stockFBO || 0),
              String(p.stockFBS || 0),
              String(total),
              String(toDisplayUzs(p.price || 0, mp)),
              String(Math.round(stockValue)),
              status,
            ]);
          }
        }
        downloadCSV(`zaxira-${dateStr}.csv`, headers, rows);
      } else if (reportId === 'pnl') {
        // Profit & Loss report
        const headers = ['Marketplace', 'Mahsulot nomi', 'Offer ID', 'Sotilgan soni', 'Daromad (so\'m)', 'Tannarxi (so\'m)', 'Yalpi foyda (so\'m)', 'Marja (%)'];
        const rows: string[][] = [];
        for (const mp of marketplacesToUse) {
          const productMap = new Map<string, { name: string; qty: number; revenue: number; costPrice: number }>();
          // Get cost prices from products
          const costPrices = new Map<string, number>();
          store.getProducts(mp).forEach((p: any) => {
            if (p.costPrice) costPrices.set(p.offerId, p.costPrice);
          });

          store.getOrders(mp)
            .filter(o => !['CANCELLED', 'RETURNED'].includes(o.status))
            .forEach(o => {
              (o.items || []).forEach((item: any) => {
                const key = item.offerId || item.name;
                const existing = productMap.get(key) || { name: item.name || item.offerId || '', qty: 0, revenue: 0, costPrice: costPrices.get(item.offerId) || 0 };
                existing.qty += item.count || 1;
                existing.revenue += toDisplayUzs((item.price || 0) * (item.count || 1), mp);
                productMap.set(key, existing);
              });
            });

          productMap.forEach((data, offerId) => {
            const totalCost = data.costPrice * data.qty;
            const profit = data.revenue - totalCost;
            const margin = data.revenue > 0 ? ((profit / data.revenue) * 100).toFixed(1) : '0';
            rows.push([
              mp,
              `"${data.name.replace(/"/g, '""')}"`,
              offerId,
              String(data.qty),
              String(Math.round(data.revenue)),
              String(Math.round(totalCost)),
              String(Math.round(profit)),
              margin + '%',
            ]);
          });
        }
        downloadCSV(`foyda-zarar-${dateStr}.csv`, headers, rows);
      }
      toast.success('Hisobot yuklab olindi!');
    } catch (err) {
      console.error('Report generation error:', err);
      toast.error('Hisobot yaratishda xatolik');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Hisobotlar va eksport</CardTitle>
          <CardDescription>Marketplacelar ma'lumotlarini CSV formatda yuklab oling</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Marketplace</label>
              <Select value={selectedMarketplace} onValueChange={setSelectedMarketplace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha marketplacelar</SelectItem>
                  {connectedMarketplaces.map(mp => (
                    <SelectItem key={mp} value={mp}>{MARKETPLACE_NAMES[mp]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Boshlanish sanasi</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(dateFrom, 'PPP')}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(date) => date && setDateFrom(date)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tugash sanasi</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(dateTo, 'PPP')}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(date) => date && setDateTo(date)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Types */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {REPORT_TYPES.map(report => {
          const Icon = report.icon;
          const isSelected = selectedReport === report.id;
          return (
            <Card key={report.id} className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedReport(isSelected ? null : report.id)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="h-6 w-6 text-primary" /></div>
                  {isSelected && <Badge>Tanlangan</Badge>}
                </div>
                <CardTitle className="text-lg">{report.name}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant={isSelected ? 'default' : 'outline'} size="sm" disabled={isGenerating || !isSelected}
                  onClick={(e) => { e.stopPropagation(); handleGenerateReport(report.id); }}>
                  {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                  CSV yuklab olish
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Tez ma'lumotlar</CardTitle>
          <CardDescription>Tanlangan davr: {format(dateFrom, 'dd.MM.yyyy')} - {format(dateTo, 'dd.MM.yyyy')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Jami sotuvlar</div>
              <div className="text-xl md:text-2xl font-bold">{formatPrice(stats.totalSales)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Buyurtmalar</div>
              <div className="text-xl md:text-2xl font-bold">{stats.totalOrders}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">O'rtacha chek</div>
              <div className="text-xl md:text-2xl font-bold">{formatPrice(stats.avgCheck)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Mahsulotlar</div>
              <div className="text-xl md:text-2xl font-bold">{stats.totalProducts}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
