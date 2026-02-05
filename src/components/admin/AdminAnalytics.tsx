import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Store, Award } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function AdminAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      // Get all orders with dates
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, user_id')
        .order('created_at', { ascending: false });

      // Get order items with shop info
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          product_id,
          subtotal,
          quantity,
          products (shop_id, shops (id, name))
        `);

      // Get profiles for growth tracking
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, created_at')
        .order('created_at', { ascending: false });

      // Get shops for growth tracking
      const { data: shops } = await supabase
        .from('shops')
        .select('id, name, created_at, total_sales')
        .order('total_sales', { ascending: false });

      // Get bloggers stats
      const { data: bloggerBalances } = await supabase
        .from('blogger_balances')
        .select('user_id, total_earned')
        .order('total_earned', { ascending: false });

      // Get blogger profiles
      const bloggerIds = bloggerBalances?.map(b => b.user_id) || [];
      const { data: bloggerProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', bloggerIds);

      // Revenue by day
      const revenueByDay = getRevenueByDay(orders || []);

      // Growth by day (users and shops)
      const growthByDay = getGrowthByDay(profiles || [], shops || []);

      // Top sellers (by revenue)
      const shopRevenue = new Map<string, { name: string; revenue: number }>();
      orderItems?.forEach(item => {
        const shop = (item.products as any)?.shops;
        if (shop) {
          if (shopRevenue.has(shop.id)) {
            shopRevenue.get(shop.id)!.revenue += Number(item.subtotal);
          } else {
            shopRevenue.set(shop.id, { name: shop.name, revenue: Number(item.subtotal) });
          }
        }
      });

      const topSellers = Array.from(shopRevenue.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Top bloggers
      const topBloggers = bloggerBalances
        ?.map(b => ({
          id: b.user_id,
          name: bloggerProfiles?.find(p => p.user_id === b.user_id)?.full_name || 'Noma\'lum',
          earned: b.total_earned || 0,
        }))
        .slice(0, 5) || [];

      // Order status distribution
      const statusCounts = {
        pending: orders?.filter(o => o.status === 'pending').length || 0,
        processing: orders?.filter(o => o.status === 'processing').length || 0,
        shipped: orders?.filter(o => o.status === 'shipped').length || 0,
        delivered: orders?.filter(o => o.status === 'delivered').length || 0,
        cancelled: orders?.filter(o => o.status === 'cancelled').length || 0,
      };

      const orderStatusData = [
        { name: 'Kutilmoqda', value: statusCounts.pending, color: '#f59e0b' },
        { name: 'Jarayonda', value: statusCounts.processing, color: '#3b82f6' },
        { name: 'Jo\'natildi', value: statusCounts.shipped, color: '#8b5cf6' },
        { name: 'Yetkazildi', value: statusCounts.delivered, color: '#10b981' },
        { name: 'Bekor', value: statusCounts.cancelled, color: '#ef4444' },
      ].filter(d => d.value > 0);

      // New this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const newUsersThisWeek = profiles?.filter(p => new Date(p.created_at) >= oneWeekAgo).length || 0;
      const newShopsThisWeek = shops?.filter(s => new Date(s.created_at) >= oneWeekAgo).length || 0;
      const newOrdersThisWeek = orders?.filter(o => new Date(o.created_at) >= oneWeekAgo).length || 0;

      return {
        revenueByDay,
        growthByDay,
        topSellers,
        topBloggers,
        orderStatusData,
        newUsersThisWeek,
        newShopsThisWeek,
        newOrdersThisWeek,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6"><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6"><div className="h-[250px] bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const formatCurrency = (value: number) => `${value.toLocaleString()} so'm`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Growth This Week */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-blue-500/10 to-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Yangi foydalanuvchilar</p>
                <p className="text-3xl font-bold">{analytics.newUsersThisWeek}</p>
                <p className="text-xs text-muted-foreground">Bu hafta</p>
              </div>
              <Users className="h-10 w-10 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Yangi do'konlar</p>
                <p className="text-3xl font-bold">{analytics.newShopsThisWeek}</p>
                <p className="text-xs text-muted-foreground">Bu hafta</p>
              </div>
              <Store className="h-10 w-10 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500/10 to-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Yangi buyurtmalar</p>
                <p className="text-3xl font-bold">{analytics.newOrdersThisWeek}</p>
                <p className="text-xs text-muted-foreground">Bu hafta</p>
              </div>
              <TrendingUp className="h-10 w-10 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Haftalik daromad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.revenueByDay.some(d => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={analytics.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                  <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Daromad']}
                    labelFormatter={formatDate}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Ma'lumot yo'q
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buyurtmalar holati</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.orderStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.orderStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Buyurtmalar yo'q
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Sellers and Bloggers */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Sellers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              TOP sotuvchilar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topSellers.length > 0 ? (
              <div className="space-y-3">
                {analytics.topSellers.map((seller, idx) => (
                  <div key={seller.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={idx === 0 ? 'default' : 'secondary'} className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                        {idx + 1}
                      </Badge>
                      <span className="font-medium">{seller.name}</span>
                    </div>
                    <span className="font-bold text-emerald-600">{formatCurrency(seller.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Hali sotuvlar yo'q
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Bloggers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              TOP bloggerlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topBloggers.length > 0 ? (
              <div className="space-y-3">
                {analytics.topBloggers.map((blogger, idx) => (
                  <div key={blogger.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={idx === 0 ? 'default' : 'secondary'} className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                        {idx + 1}
                      </Badge>
                      <span className="font-medium">{blogger.name}</span>
                    </div>
                    <span className="font-bold text-purple-600">{formatCurrency(blogger.earned)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Hali bloggerlar yo'q
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User & Shop Growth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Haftalik o'sish
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.growthByDay.some(d => d.users > 0 || d.shops > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.growthByDay} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                <YAxis 
                  className="text-xs" 
                  allowDecimals={false} 
                  tickFormatter={(v) => Math.floor(v).toString()}
                  domain={[0, 'auto']}
                />
                <Tooltip labelFormatter={formatDate} />
                <Bar dataKey="users" name="Foydalanuvchilar" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="shops" name="Do'konlar" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Ma'lumot yo'q
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getRevenueByDay(orders: any[]): { date: string; revenue: number; orders: number }[] {
  const last7Days: { date: string; revenue: number; orders: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at).toISOString().split('T')[0];
      return orderDate === dateStr && o.status !== 'cancelled';
    });

    last7Days.push({
      date: dateStr,
      revenue: dayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
      orders: dayOrders.length,
    });
  }

  return last7Days;
}

function getGrowthByDay(profiles: any[], shops: any[]): { date: string; users: number; shops: number }[] {
  const last7Days: { date: string; users: number; shops: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayUsers = profiles.filter(p => {
      const pDate = new Date(p.created_at).toISOString().split('T')[0];
      return pDate === dateStr;
    }).length;

    const dayShops = shops.filter(s => {
      const sDate = new Date(s.created_at).toISOString().split('T')[0];
      return sDate === dateStr;
    }).length;

    last7Days.push({
      date: dateStr,
      users: dayUsers,
      shops: dayShops,
    });
  }

  return last7Days;
}
