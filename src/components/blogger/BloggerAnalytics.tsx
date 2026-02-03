import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package, Percent } from 'lucide-react';
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
} from 'recharts';

export function BloggerAnalytics() {
  const { user } = useAuth();

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['blogger-analytics', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get affiliate links with product info
      const { data: links } = await supabase
        .from('affiliate_links')
        .select(`
          id,
          clicks,
          conversions,
          total_commission,
          product_id,
          products (name, price)
        `)
        .eq('blogger_id', user.id);

      // Get commissions history
      const { data: commissions } = await supabase
        .from('commissions')
        .select('*')
        .eq('blogger_id', user.id)
        .order('created_at', { ascending: false });

      // Calculate stats
      const totalClicks = links?.reduce((sum, l) => sum + (l.clicks || 0), 0) || 0;
      const totalConversions = links?.reduce((sum, l) => sum + (l.conversions || 0), 0) || 0;
      const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

      // Top performing products
      const topProducts = links
        ?.map(link => ({
          id: link.id,
          name: (link.products as any)?.name || 'Noma\'lum',
          clicks: link.clicks || 0,
          conversions: link.conversions || 0,
          commission: link.total_commission || 0,
        }))
        .sort((a, b) => b.commission - a.commission)
        .slice(0, 5) || [];

      // Earnings by day (last 7 days)
      const earningsByDay = getEarningsByDay(commissions || []);

      return {
        conversionRate,
        topProducts,
        earningsByDay,
        totalCommissions: commissions?.length || 0,
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-[200px] bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analyticsData) return null;

  const formatCurrency = (value: number) => `${value.toLocaleString()} so'm`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Conversion Rate Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-full">
              <Percent className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Konversiya foizi</p>
              <p className="text-3xl font-bold">{analyticsData.conversionRate.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">
                Bosishlardan sotuvga o'tish nisbati
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Haftalik daromad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.earningsByDay.length > 0 && analyticsData.earningsByDay.some(d => d.earnings > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analyticsData.earningsByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    className="text-xs"
                  />
                  <YAxis 
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Daromad']}
                    labelFormatter={formatDate}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Hali daromad yo'q
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              TOP mahsulotlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsData.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Komissiya']}
                  />
                  <Bar dataKey="commission" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Hali affiliate havolalar yo'q
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products Table */}
      {analyticsData.topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mahsulotlar statistikasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Mahsulot</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-muted-foreground">Bosishlar</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-muted-foreground">Sotuvlar</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-muted-foreground">Konversiya</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Daromad</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.topProducts.map((product) => (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="py-3 px-3 font-medium">{product.name}</td>
                      <td className="py-3 px-3 text-center">{product.clicks}</td>
                      <td className="py-3 px-3 text-center">{product.conversions}</td>
                      <td className="py-3 px-3 text-center">
                        {product.clicks > 0 ? ((product.conversions / product.clicks) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        {formatCurrency(product.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getEarningsByDay(commissions: any[]): { date: string; earnings: number }[] {
  const last7Days: { date: string; earnings: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayEarnings = commissions
      .filter(c => {
        const commDate = new Date(c.created_at).toISOString().split('T')[0];
        return commDate === dateStr;
      })
      .reduce((sum, c) => sum + Number(c.commission_amount), 0);

    last7Days.push({
      date: dateStr,
      earnings: dayEarnings,
    });
  }

  return last7Days;
}
