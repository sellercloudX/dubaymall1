import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Globe, Crown } from 'lucide-react';
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
      // Get profiles for growth tracking
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, created_at')
        .order('created_at', { ascending: false });

      // Get marketplace connections for SellerCloudX stats
      const { data: connections } = await supabase
        .from('marketplace_connections')
        .select('id, marketplace, created_at, is_active, total_revenue, products_count, orders_count')
        .order('created_at', { ascending: false });

      // Get subscriptions
      const { data: subscriptions } = await supabase
        .from('sellercloud_subscriptions')
        .select('id, is_active, plan_type, created_at, user_id')
        .order('created_at', { ascending: false });

      // Growth by day (users and subscriptions)
      const growthByDay = getGrowthByDay(profiles || [], subscriptions || []);

      // Marketplace distribution
      const marketplaceCounts = new Map<string, number>();
      connections?.forEach(c => {
        if (c.is_active) {
          const count = marketplaceCounts.get(c.marketplace) || 0;
          marketplaceCounts.set(c.marketplace, count + 1);
        }
      });
      
      const marketplaceDistribution = Array.from(marketplaceCounts.entries())
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: name === 'yandex' ? '#FBBF24' : name === 'uzum' ? '#A855F7' : name === 'wildberries' ? '#EC4899' : '#3B82F6',
        }))
        .filter(d => d.value > 0);

      // Subscription status distribution
      const activeSubscriptions = subscriptions?.filter(s => s.is_active).length || 0;
      const pendingSubscriptions = subscriptions?.filter(s => !s.is_active).length || 0;
      const totalConnections = connections?.filter(c => c.is_active).length || 0;

      // New this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const newUsersThisWeek = profiles?.filter(p => new Date(p.created_at) >= oneWeekAgo).length || 0;
      const newSubscriptionsThisWeek = subscriptions?.filter(s => new Date(s.created_at) >= oneWeekAgo).length || 0;
      const newConnectionsThisWeek = connections?.filter(c => new Date(c.created_at) >= oneWeekAgo).length || 0;

      // Total revenue from connections
      const totalRevenue = connections?.reduce((sum, c) => sum + (c.total_revenue || 0), 0) || 0;

      return {
        growthByDay,
        marketplaceDistribution,
        newUsersThisWeek,
        newSubscriptionsThisWeek,
        newConnectionsThisWeek,
        activeSubscriptions,
        pendingSubscriptions,
        totalConnections,
        totalRevenue,
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
      </div>
    );
  }

  if (!analytics) return null;

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
                <p className="text-sm text-muted-foreground">Yangi obunalar</p>
                <p className="text-3xl font-bold">{analytics.newSubscriptionsThisWeek}</p>
                <p className="text-xs text-muted-foreground">Bu hafta</p>
              </div>
              <Crown className="h-10 w-10 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500/10 to-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Yangi ulanishlar</p>
                <p className="text-3xl font-bold">{analytics.newConnectionsThisWeek}</p>
                <p className="text-xs text-muted-foreground">Bu hafta (marketplace)</p>
              </div>
              <Globe className="h-10 w-10 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Marketplace Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Marketplace taqsimoti
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.marketplaceDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.marketplaceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.marketplaceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Hali ulanishlar yo'q
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              SellerCloudX statistikasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Faol obunalar</span>
                <Badge className="bg-emerald-600">{analytics.activeSubscriptions}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Kutilayotgan obunalar</span>
                <Badge variant="secondary">{analytics.pendingSubscriptions}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Faol marketplace ulanishlari</span>
                <Badge variant="outline">{analytics.totalConnections}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Jami sinxron daromad</span>
                <span className="font-bold text-primary">{analytics.totalRevenue >= 1000000 ? `${(analytics.totalRevenue / 1000000).toFixed(1)} mln` : analytics.totalRevenue.toLocaleString()} so'm</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User & Subscription Growth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Haftalik o'sish
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.growthByDay.some(d => d.users > 0 || d.subscriptions > 0) ? (
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
                <Bar dataKey="subscriptions" name="Obunalar" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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

function getGrowthByDay(profiles: any[], subscriptions: any[]): { date: string; users: number; subscriptions: number }[] {
  const last7Days: { date: string; users: number; subscriptions: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayUsers = profiles.filter(p => {
      const pDate = new Date(p.created_at).toISOString().split('T')[0];
      return pDate === dateStr;
    }).length;

    const daySubs = subscriptions.filter(s => {
      const sDate = new Date(s.created_at).toISOString().split('T')[0];
      return sDate === dateStr;
    }).length;

    last7Days.push({
      date: dateStr,
      users: dayUsers,
      subscriptions: daySubs,
    });
  }

  return last7Days;
}
