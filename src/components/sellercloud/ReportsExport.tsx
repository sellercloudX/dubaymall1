import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileSpreadsheet, Download, Calendar as CalendarIcon, 
  BarChart3, Package, ShoppingCart, DollarSign, TrendingUp, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface ReportsExportProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const REPORT_TYPES = [
  { id: 'sales', name: 'Sotuvlar hisoboti', description: 'Barcha sotuvlar, daromad va foydalar', icon: DollarSign, formats: ['csv'] },
  { id: 'products', name: 'Mahsulotlar hisoboti', description: 'Barcha mahsulotlar, zaxira va narxlar', icon: Package, formats: ['csv'] },
  { id: 'orders', name: 'Buyurtmalar hisoboti', description: 'Barcha buyurtmalar va holati', icon: ShoppingCart, formats: ['csv'] },
  { id: 'inventory', name: 'Zaxira hisoboti', description: 'Barcha marketplacedagi zaxiralar', icon: BarChart3, formats: ['csv'] },
];

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market', uzum: 'Uzum Market', wildberries: 'Wildberries', ozon: 'Ozon', all: 'Barcha marketplacelar',
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
        const headers = ['Marketplace', 'Nomi', 'Offer ID', 'SKU', 'Narxi', 'FBO', 'FBS', 'Jami zaxira', 'Holat'];
        const rows: string[][] = [];
        for (const mp of marketplacesToUse) {
          for (const p of store.getProducts(mp)) {
            rows.push([mp, `"${(p.name || '').replace(/"/g, '""')}"`, p.offerId, p.shopSku || '', String(p.price || 0), String(p.stockFBO || 0), String(p.stockFBS || 0), String((p.stockFBO || 0) + (p.stockFBS || 0)), p.availability || '']);
          }
        }
        downloadCSV(`mahsulotlar-${dateStr}.csv`, headers, rows);
      } else if (reportId === 'orders' || reportId === 'sales') {
        const headers = ['Marketplace', 'Buyurtma ID', 'Sana', 'Holat', 'Mahsulotlar soni', 'Mahsulotlar summasi', 'Yetkazish', 'Jami'];
        const rows: string[][] = [];
        for (const mp of marketplacesToUse) {
          for (const o of store.getOrders(mp)) {
            rows.push([mp, String(o.id), o.createdAt, o.status, String(o.items?.length || 0), String(o.itemsTotalUZS || o.itemsTotal || 0), String(o.deliveryTotalUZS || o.deliveryTotal || 0), String(o.totalUZS || o.total || 0)]);
          }
        }
        downloadCSV(`${reportId === 'sales' ? 'sotuvlar' : 'buyurtmalar'}-${dateStr}.csv`, headers, rows);
      } else if (reportId === 'inventory') {
        const headers = ['Marketplace', 'Nomi', 'SKU', 'FBO', 'FBS', 'Jami', 'Holat'];
        const rows: string[][] = [];
        for (const mp of marketplacesToUse) {
          for (const p of store.getProducts(mp)) {
            const total = (p.stockFBO || 0) + (p.stockFBS || 0);
            rows.push([mp, `"${(p.name || '').replace(/"/g, '""')}"`, p.shopSku || p.offerId, String(p.stockFBO || 0), String(p.stockFBS || 0), String(total), total === 0 ? 'Tugagan' : total < 10 ? 'Kam' : 'Yetarli']);
          }
        }
        downloadCSV(`zaxira-${dateStr}.csv`, headers, rows);
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
