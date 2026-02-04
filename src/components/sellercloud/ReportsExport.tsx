import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileSpreadsheet, FileText, Download, Calendar as CalendarIcon, 
  BarChart3, Package, ShoppingCart, DollarSign, TrendingUp, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface ReportsExportProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData?: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

const REPORT_TYPES = [
  {
    id: 'sales',
    name: 'Sotuvlar hisoboti',
    description: 'Barcha sotuvlar, daromad va foydalar',
    icon: DollarSign,
    formats: ['xlsx', 'csv', 'pdf'],
  },
  {
    id: 'products',
    name: 'Mahsulotlar hisoboti',
    description: 'Barcha mahsulotlar, zaxira va narxlar',
    icon: Package,
    formats: ['xlsx', 'csv'],
  },
  {
    id: 'orders',
    name: 'Buyurtmalar hisoboti',
    description: 'Barcha buyurtmalar va yetkazib berish holati',
    icon: ShoppingCart,
    formats: ['xlsx', 'csv', 'pdf'],
  },
  {
    id: 'analytics',
    name: 'Analitika hisoboti',
    description: 'Ko\'rishlar, konversiya va trendlar',
    icon: TrendingUp,
    formats: ['xlsx', 'pdf'],
  },
  {
    id: 'inventory',
    name: 'Zaxira hisoboti',
    description: 'Barcha marketplacedagi zaxiralar',
    icon: BarChart3,
    formats: ['xlsx', 'csv'],
  },
];

const MARKETPLACE_NAMES: Record<string, string> = {
  yandex: 'Yandex Market',
  uzum: 'Uzum Market',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
  all: 'Barcha marketplacelar',
};

interface ReportStats {
  totalSales: number;
  totalOrders: number;
  avgCheck: number;
  totalProducts: number;
}

export function ReportsExport({ connectedMarketplaces, fetchMarketplaceData }: ReportsExportProps) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ReportStats>({ totalSales: 0, totalOrders: 0, avgCheck: 0, totalProducts: 0 });

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && fetchMarketplaceData) {
      loadStats();
    } else {
      setIsLoading(false);
    }
  }, [connectedMarketplaces, selectedMarketplace]);

  const loadStats = async () => {
    if (!fetchMarketplaceData) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      let totalSales = 0;
      let totalOrders = 0;
      let totalProducts = 0;

      const marketplacesToFetch = selectedMarketplace === 'all' 
        ? connectedMarketplaces 
        : [selectedMarketplace];

      for (const mp of marketplacesToFetch) {
        const [productsResult, ordersResult] = await Promise.all([
          fetchMarketplaceData(mp, 'products', { limit: 200, fetchAll: true }),
          fetchMarketplaceData(mp, 'orders', { fetchAll: true }),
        ]);

        totalProducts += productsResult.total || productsResult.data?.length || 0;
        
        const orders = ordersResult.data || [];
        totalOrders += orders.length;
        totalSales += orders.reduce((sum: number, order: any) => {
          return sum + (order.totalUZS || order.total || 0);
        }, 0);
      }

      setStats({
        totalSales,
        totalOrders,
        avgCheck: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
        totalProducts,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async (reportId: string, format: string) => {
    setIsGenerating(true);
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
    
    // In real implementation, this would trigger download
    console.log(`Generating ${reportId} report in ${format} format`);
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + ' mln so\'m';
    }
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Hisobotlar va eksport
          </CardTitle>
          <CardDescription>
            Marketplacelar ma'lumotlarini Excel, CSV yoki PDF formatda yuklab oling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Marketplace Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Marketplace</label>
              <Select value={selectedMarketplace} onValueChange={setSelectedMarketplace}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha marketplacelar</SelectItem>
                  {connectedMarketplaces.map(mp => (
                    <SelectItem key={mp} value={mp}>
                      {MARKETPLACE_NAMES[mp]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Boshlanish sanasi</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tugash sanasi</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Types */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map(report => {
          const Icon = report.icon;
          const isSelected = selectedReport === report.id;
          return (
            <Card 
              key={report.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedReport(isSelected ? null : report.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  {isSelected && (
                    <Badge>Tanlangan</Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{report.name}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {report.formats.map(fmt => (
                    <Button
                      key={fmt}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      disabled={isGenerating || !isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateReport(report.id, fmt);
                      }}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      {fmt.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Tez ma'lumotlar</CardTitle>
          <CardDescription>
            Tanlangan davr: {format(dateFrom, 'dd.MM.yyyy')} - {format(dateTo, 'dd.MM.yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
