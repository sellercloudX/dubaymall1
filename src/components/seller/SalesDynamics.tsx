import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSellerStats } from '@/hooks/useSellerStats';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  ShoppingCart,
  BarChart3
} from 'lucide-react';
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
  ComposedChart,
  Line,
} from 'recharts';

interface SalesDynamicsProps {
  shopId: string;
}

type Period = '7d' | '30d' | '90d';

export function SalesDynamics({ shopId }: SalesDynamicsProps) {
  const [period, setPeriod] = useState<Period>('30d');

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-dynamics', shopId, period],
    queryFn: async () => {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get products
      const { data: products } = await supabase
        .from('products')
        .select('id, view_count')
        .eq('shop_id', shopId);

      const productIds = products?.map(p => p.id) || [];
      if (productIds.length === 0) return { daily: [], summary: getEmptySummary() };

      // Get order items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity,
          subtotal,
          created_at,
          orders (status, created_at)
        `)
        .in('product_id', productIds)
        .gte('created_at', startDate.toISOString());

      // Build daily data
      const dailyMap = new Map<string, { revenue: number; orders: number; items: number }>();
      
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap.set(d.toISOString().split('T')[0], { revenue: 0, orders: 0, items: 0 });
      }

      const orderIds = new Set<string>();
      orderItems?.forEach(item => {
        const order = item.orders as any;
        if (!order || order.status === 'cancelled') return;
        const dateStr = new Date(item.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(dateStr);
        if (existing) {
          existing.revenue += Number(item.subtotal);
          existing.items += item.quantity;
          // Approximate unique orders
          const orderId = `${dateStr}-${order.created_at}`;
          if (!orderIds.has(orderId)) {
            orderIds.add(orderId);
            existing.orders += 1;
          }
        }
      });

      const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));

      // Summary
      const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
      const totalOrders = daily.reduce((s, d) => s + d.orders, 0);
      const totalItems = daily.reduce((s, d) => s + d.items, 0);
      const avgDailyRevenue = totalRevenue / days;
      
      // Split half for comparison
      const halfIndex = Math.floor(daily.length / 2);
      const firstHalf = daily.slice(0, halfIndex);
      const secondHalf = daily.slice(halfIndex);
      const firstHalfRevenue = firstHalf.reduce((s, d) => s + d.revenue, 0);
      const secondHalfRevenue = secondHalf.reduce((s, d) => s + d.revenue, 0);
      const growthPercent = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

      return {
        daily,
        summary: {
          totalRevenue,
          totalOrders,
          totalItems,
          avgDailyRevenue,
          growthPercent,
          bestDay: daily.reduce((best, d) => d.revenue > best.revenue ? d : best, daily[0]),
        },
      };
    },
    enabled: !!shopId,
    staleTime: 60000,
  });

  const formatCurrency = (value: number) => `${value.toLocaleString()} so'm`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6"><div className="h-24 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { daily = [], summary } = salesData || { daily: [], summary: getEmptySummary() };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Savdo dinamikasi
          </h2>
          <p className="text-sm text-muted-foreground">Sotuvlar trendi va o'sish ko'rsatkichlari</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {([['7d', '7 kun'], ['30d', '30 kun'], ['90d', '90 kun']] as const).map(([key, label]) => (
            <Button
              key={key}
              variant={period === key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(key)}
              className="text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Jami daromad</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(Math.round(summary.totalRevenue))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Buyurtmalar</p>
            <p className="text-xl font-bold mt-1">{summary.totalOrders}</p>
            <p className="text-xs text-muted-foreground">{summary.totalItems} ta mahsulot</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">O'rtacha kunlik</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(Math.round(summary.avgDailyRevenue))}</p>
          </CardContent>
        </Card>
        <Card className={summary.growthPercent > 0 ? 'border-emerald-500/30' : summary.growthPercent < 0 ? 'border-destructive/30' : ''}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">O'sish</p>
            <div className="flex items-center gap-1 mt-1">
              {summary.growthPercent > 0 ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              ) : summary.growthPercent < 0 ? (
                <ArrowDownRight className="h-5 w-5 text-destructive" />
              ) : (
                <Minus className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={`text-xl font-bold ${summary.growthPercent > 0 ? 'text-emerald-500' : summary.growthPercent < 0 ? 'text-destructive' : ''}`}>
                {summary.growthPercent > 0 ? '+' : ''}{summary.growthPercent.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daromad va buyurtmalar</CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                <YAxis yAxisId="revenue" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <YAxis yAxisId="orders" orientation="right" className="text-xs" />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(Math.round(value)) : value,
                    name === 'revenue' ? 'Daromad' : 'Buyurtmalar',
                  ]}
                  labelFormatter={formatDate}
                />
                <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Ma'lumot yo'q
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best Day */}
      {summary.bestDay && summary.bestDay.revenue > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Eng yaxshi kun</p>
              <p className="font-bold">
                {formatDate(summary.bestDay.date)} — {formatCurrency(Math.round(summary.bestDay.revenue))}
                <span className="text-muted-foreground font-normal ml-2">({summary.bestDay.orders} buyurtma)</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getEmptySummary() {
  return {
    totalRevenue: 0,
    totalOrders: 0,
    totalItems: 0,
    avgDailyRevenue: 0,
    growthPercent: 0,
    bestDay: { date: new Date().toISOString().split('T')[0], revenue: 0, orders: 0, items: 0 },
  };
}
