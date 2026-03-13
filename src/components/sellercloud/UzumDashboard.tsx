import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Package, ShoppingCart, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, Calculator, Truck, BarChart3, RefreshCw, Search,
  ArrowUpRight, ArrowDownRight, Warehouse, PackageX, Zap, Eye,
  FileText, UserPlus, Send,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import UzumUnitEconomics from './UzumUnitEconomics';
import UzumLostItems from './UzumLostItems';
import UzumProductCardCreator from './UzumProductCardCreator';
import UzumBoostManager from './UzumBoostManager';
import UzumManagerInvite from './UzumManagerInvite';
import UzumFBSLogistics from './UzumFBSLogistics';

interface UzumDashboardProps {
  marketplace?: string;
}

// Format number with spaces as thousands separator
const fmt = (n: number, decimals = 0) =>
  n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function UzumDashboard({ marketplace = 'uzum' }: UzumDashboardProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    fboOrders: 0,
    fbsOrders: 0,
    avgOrderValue: 0,
    returnRate: 0,
    lostItems: 0,
    activeBoosts: 0,
    pendingFbs: 0,
  });

  const loadStats = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('uzum_products').select('id, price, stock_fbo, stock_fbs, boost_active', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('uzum_orders').select('id, total_amount, fulfillment_type, status, is_lost', { count: 'exact' }).eq('user_id', user.id),
      ]);

      const products = productsRes.data || [];
      const orders = ordersRes.data || [];

      const fboOrders = orders.filter(o => o.fulfillment_type === 'FBO');
      const fbsOrders = orders.filter(o => o.fulfillment_type === 'FBS');
      const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const returnedOrders = orders.filter(o => o.status === 'returned' || o.status === 'RETURNED');
      const lostItems = orders.filter(o => o.is_lost);
      const activeBoosts = products.filter(p => p.boost_active);
      const pendingFbs = fbsOrders.filter(o => ['created', 'CREATED', 'PACKING'].includes(o.status));

      setStats({
        totalProducts: productsRes.count || products.length,
        totalOrders: ordersRes.count || orders.length,
        totalRevenue,
        fboOrders: fboOrders.length,
        fbsOrders: fbsOrders.length,
        avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        returnRate: orders.length > 0 ? (returnedOrders.length / orders.length) * 100 : 0,
        lostItems: lostItems.length,
        activeBoosts: activeBoosts.length,
        pendingFbs: pendingFbs.length,
      });
    } catch (err) {
      console.error('Failed to load Uzum stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statCards = [
    { label: 'Jami mahsulotlar', value: stats.totalProducts, icon: Package, color: 'text-primary' },
    { label: 'Jami buyurtmalar', value: stats.totalOrders, icon: ShoppingCart, color: 'text-accent' },
    { label: 'Daromad', value: `${fmt(stats.totalRevenue)} so'm`, icon: DollarSign, color: 'text-success' },
    { label: 'O\'rtacha chek', value: `${fmt(stats.avgOrderValue)} so'm`, icon: TrendingUp, color: 'text-warning' },
    { label: 'FBO buyurtmalar', value: stats.fboOrders, icon: Warehouse, color: 'text-primary' },
    { label: 'FBS buyurtmalar', value: stats.fbsOrders, icon: Truck, color: 'text-accent' },
    { label: 'Qaytish %', value: `${stats.returnRate.toFixed(1)}%`, icon: TrendingDown, color: 'text-destructive' },
    { label: 'Yo\'qolgan tovarlar', value: stats.lostItems, icon: PackageX, color: stats.lostItems > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            Uzum Market Dashboard
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">FBO/FBS boshqaruv va tahlil markazi</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadStats}
          disabled={isLoading}
          className="h-8 text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <Card key={i} className="border-border/50 bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                {typeof card.value === 'number' && card.value > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />
                    aktiv
                  </Badge>
                )}
              </div>
              <div className="text-lg font-bold text-foreground">{card.value}</div>
              <div className="text-[10px] text-muted-foreground">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex h-9 w-auto min-w-full">
            <TabsTrigger value="overview" className="text-[10px] px-2">
              <BarChart3 className="w-3 h-3 mr-1" />
              Umumiy
            </TabsTrigger>
            <TabsTrigger value="unit-economics" className="text-[10px] px-2">
              <Calculator className="w-3 h-3 mr-1" />
              Unit Econ
            </TabsTrigger>
            <TabsTrigger value="lost-items" className="text-[10px] px-2">
              <PackageX className="w-3 h-3 mr-1" />
              Yo'qolgan
            </TabsTrigger>
            <TabsTrigger value="card-creator" className="text-[10px] px-2">
              <FileText className="w-3 h-3 mr-1" />
              Kartochka
            </TabsTrigger>
            <TabsTrigger value="boost" className="text-[10px] px-2">
              <Zap className="w-3 h-3 mr-1" />
              Boost
            </TabsTrigger>
            <TabsTrigger value="manager" className="text-[10px] px-2">
              <UserPlus className="w-3 h-3 mr-1" />
              Manager
            </TabsTrigger>
            <TabsTrigger value="fbs" className="text-[10px] px-2">
              <Truck className="w-3 h-3 mr-1" />
              FBS
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* FBO vs FBS Breakdown */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-primary" />
                FBO vs FBS taqqoslash
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">FBO (Uzum ombori)</span>
                  <span className="font-medium text-foreground">{stats.fboOrders} buyurtma</span>
                </div>
                <Progress
                  value={stats.totalOrders > 0 ? (stats.fboOrders / stats.totalOrders) * 100 : 0}
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">FBS (Shaxsiy yetkazish)</span>
                  <span className="font-medium text-foreground">{stats.fbsOrders} buyurtma</span>
                </div>
                <Progress
                  value={stats.totalOrders > 0 ? (stats.fbsOrders / stats.totalOrders) * 100 : 0}
                  className="h-2 [&>div]:bg-accent"
                />
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-foreground">
                    {stats.totalOrders > 0 ? ((stats.fboOrders / stats.totalOrders) * 100).toFixed(0) : 0}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">FBO ulushi</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">
                    {stats.totalOrders > 0 ? ((stats.fbsOrders / stats.totalOrders) * 100).toFixed(0) : 0}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">FBS ulushi</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{stats.returnRate.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Qaytish</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning" />
                Tez amallar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-9 text-xs justify-start" onClick={() => setActiveTab('unit-economics')}>
                  <Calculator className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Unit ekonomika
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs justify-start" onClick={() => setActiveTab('lost-items')}>
                  <PackageX className="w-3.5 h-3.5 mr-1.5 text-destructive" />
                  Yo'qolgan tovarlar
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs justify-start" onClick={() => setActiveTab('fbs')}>
                  <Truck className="w-3.5 h-3.5 mr-1.5 text-accent" />
                  FBS buyurtmalar
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs justify-start">
                  <Eye className="w-3.5 h-3.5 mr-1.5 text-success" />
                  Boost boshqaruv
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unit Economics Tab */}
        <TabsContent value="unit-economics">
          <UzumUnitEconomics />
        </TabsContent>

        {/* Lost Items Tab */}
        <TabsContent value="lost-items">
          <UzumLostItems />
        </TabsContent>

        {/* FBS Tab */}
        <TabsContent value="fbs" className="space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-accent" />
                FBS kutilayotgan buyurtmalar
                {stats.pendingFbs > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4">{stats.pendingFbs}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.pendingFbs === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Hozircha kutilayotgan FBS buyurtmalar yo'q</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    {stats.pendingFbs} ta buyurtma yig'ish va jo'natish kutilmoqda
                  </p>
                  <Button size="sm" className="mt-3 text-xs">
                    <Package className="w-3.5 h-3.5 mr-1.5" />
                    Etiketka generatsiya qilish
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Card Creator Tab */}
        <TabsContent value="card-creator">
          <UzumProductCardCreator />
        </TabsContent>

        {/* Boost Tab */}
        <TabsContent value="boost">
          <UzumBoostManager />
        </TabsContent>

        {/* Manager Tab */}
        <TabsContent value="manager">
          <UzumManagerInvite />
        </TabsContent>
      </Tabs>
    </div>
  );
}
