import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Crown,
  Repeat, Target, Zap, ArrowUpRight, ArrowDownRight,
  Activity, Percent,
} from 'lucide-react';

const USD_RATE = 12800;

export function StartupMetrics() {
  const [period, setPeriod] = useState<'30d' | '90d' | '365d'>('30d');

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['startup-metrics', period],
    queryFn: async () => {
      const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Subscriptions for MRR/ARR
      const { data: subs } = await supabase
        .from('sellercloud_subscriptions')
        .select('id, user_id, is_active, monthly_fee, commission_percent, created_at, started_at');

      // Platform revenue
      const { data: revenue } = await supabase
        .from('platform_revenue')
        .select('amount, source_type, created_at')
        .gte('created_at', startDate.toISOString());

      // Users for growth
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, created_at');

      // Expenses
      const { data: expenses } = await supabase
        .from('platform_expenses')
        .select('amount, currency, expense_type, created_at')
        .gte('created_at', startDate.toISOString());

      // AI Usage
      const { data: aiUsage } = await supabase
        .from('ai_usage_log')
        .select('estimated_cost_usd, action_type, created_at')
        .gte('created_at', startDate.toISOString());

      // Order financials
      const { data: orderFin } = await supabase
        .from('order_financials')
        .select('platform_commission_amount, order_total, created_at')
        .gte('created_at', startDate.toISOString());

      // === Calculations ===
      const activeSubs = subs?.filter(s => s.is_active) || [];
      const mrr = activeSubs.reduce((sum, s) => sum + (s.monthly_fee || 0) * USD_RATE, 0);
      const arr = mrr * 12;

      // Commission revenue this period
      const commissionRevenue = orderFin?.reduce((sum, f) => sum + (f.platform_commission_amount || 0), 0) || 0;

      // Total revenue this period
      const totalRevenue = revenue?.reduce((sum, r) => sum + r.amount, 0) || 0;

      // Total expenses this period
      const totalExpenses = expenses?.reduce((sum, e) => {
        const amt = e.currency === 'USD' ? e.amount * USD_RATE : e.amount;
        return sum + amt;
      }, 0) || 0;

      // AI costs
      const totalAICost = aiUsage?.reduce((sum, a) => sum + (a.estimated_cost_usd || 0), 0) || 0;

      // Net profit
      const netProfit = totalRevenue + commissionRevenue - totalExpenses - (totalAICost * USD_RATE);

      // Churn: subs created before period that are now inactive
      const totalEverSubs = subs?.length || 1;
      const inactiveSubs = subs?.filter(s => !s.is_active).length || 0;
      const churnRate = totalEverSubs > 0 ? (inactiveSubs / totalEverSubs) * 100 : 0;

      // LTV = ARPU / Churn
      const arpu = activeSubs.length > 0 ? mrr / activeSubs.length : 0;
      const monthlyChurn = churnRate / 100;
      const ltv = monthlyChurn > 0 ? arpu / monthlyChurn : arpu * 24;

      // Growth: new users this period vs previous
      const periodUsers = profiles?.filter(p => new Date(p.created_at) >= startDate).length || 0;
      const prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - days);
      const prevUsers = profiles?.filter(p => {
        const d = new Date(p.created_at);
        return d >= prevStart && d < startDate;
      }).length || 0;
      const userGrowth = prevUsers > 0 ? ((periodUsers - prevUsers) / prevUsers) * 100 : 100;

      // Revenue by day for chart
      const revenueByDay = getDataByDay(revenue || [], days, 'amount');
      const expensesByDay = getDataByDay(expenses || [], days, 'amount');

      // New subs this period
      const newSubs = subs?.filter(s => new Date(s.created_at) >= startDate).length || 0;

      return {
        mrr, arr, commissionRevenue, totalRevenue,
        totalExpenses, totalAICost, netProfit,
        churnRate, ltv, arpu,
        activeSubs: activeSubs.length,
        totalSubs: subs?.length || 0,
        newSubs,
        totalUsers: profiles?.length || 0,
        periodUsers, userGrowth,
        revenueByDay, expensesByDay,
        totalOrderVolume: orderFin?.reduce((s, f) => s + (f.order_total || 0), 0) || 0,
        aiActions: aiUsage?.length || 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6"><div className="h-20 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const formatUZS = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + ' mlrd';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + ' mln';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return v.toLocaleString();
  };

  const kpis = [
    { label: 'MRR', value: formatUZS(metrics.mrr) + " so'm", icon: DollarSign, color: 'text-emerald-500', bg: 'from-emerald-500/10 to-emerald-500/5' },
    { label: 'ARR', value: formatUZS(metrics.arr) + " so'm", icon: TrendingUp, color: 'text-blue-500', bg: 'from-blue-500/10 to-blue-500/5' },
    { label: 'Faol obunalar', value: `${metrics.activeSubs}/${metrics.totalSubs}`, icon: Crown, color: 'text-amber-500', bg: 'from-amber-500/10 to-amber-500/5' },
    { label: 'Churn Rate', value: metrics.churnRate.toFixed(1) + '%', icon: Repeat, color: metrics.churnRate > 10 ? 'text-red-500' : 'text-green-500', bg: metrics.churnRate > 10 ? 'from-red-500/10 to-red-500/5' : 'from-green-500/10 to-green-500/5' },
    { label: 'LTV (o\'rtacha)', value: formatUZS(metrics.ltv) + " so'm", icon: Target, color: 'text-purple-500', bg: 'from-purple-500/10 to-purple-500/5' },
    { label: 'ARPU', value: formatUZS(metrics.arpu) + " so'm", icon: Users, color: 'text-indigo-500', bg: 'from-indigo-500/10 to-indigo-500/5' },
    { label: 'Sof foyda', value: formatUZS(metrics.netProfit) + " so'm", icon: Activity, color: metrics.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500', bg: metrics.netProfit >= 0 ? 'from-emerald-500/10 to-emerald-500/5' : 'from-red-500/10 to-red-500/5' },
    { label: 'AI rasxodi', value: '$' + metrics.totalAICost.toFixed(2), icon: Zap, color: 'text-orange-500', bg: 'from-orange-500/10 to-orange-500/5' },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Startup metrikalar</h2>
          <p className="text-sm text-muted-foreground">Asosiy KPI ko'rsatkichlari</p>
        </div>
        <Select value={period} onValueChange={(v: '30d' | '90d' | '365d') => setPeriod(v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">30 kun</SelectItem>
            <SelectItem value="90d">90 kun</SelectItem>
            <SelectItem value="365d">1 yil</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className={`bg-gradient-to-r ${kpi.bg}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Yangi obunalar</p>
            <p className="text-2xl font-bold text-primary">{metrics.newSubs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Yangi foydalanuvchilar</p>
            <p className="text-2xl font-bold">{metrics.periodUsers}</p>
            <p className={`text-xs flex items-center gap-0.5 ${metrics.userGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {metrics.userGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(metrics.userGrowth).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Komissiya daromad</p>
            <p className="text-lg font-bold text-emerald-600">{formatUZS(metrics.commissionRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Savdo hajmi (GMV)</p>
            <p className="text-lg font-bold">{formatUZS(metrics.totalOrderVolume)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">AI amallar</p>
            <p className="text-2xl font-bold text-orange-500">{metrics.aiActions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Daromad va Xarajatlar dinamikasi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mergeChartData(metrics.revenueByDay, metrics.expensesByDay)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatUZS(v)} />
              <Tooltip formatter={(v: number) => formatUZS(v) + " so'm"} />
              <Area type="monotone" dataKey="revenue" name="Daromad" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Xarajat" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function getDataByDay(records: any[], days: number, amountKey: string) {
  const result: { date: string; value: number }[] = [];
  const today = new Date();
  const bucketSize = days > 60 ? 7 : 1;
  const buckets = Math.ceil(days / bucketSize);

  for (let i = buckets - 1; i >= 0; i--) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * bucketSize);
    const start = new Date(end);
    start.setDate(start.getDate() - bucketSize);

    const sum = records.filter(r => {
      const d = new Date(r.created_at);
      return d >= start && d < end;
    }).reduce((s, r) => s + (r[amountKey] || 0), 0);

    result.push({
      date: end.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
      value: sum,
    });
  }
  return result;
}

function mergeChartData(
  revenue: { date: string; value: number }[],
  expenses: { date: string; value: number }[]
) {
  return revenue.map((r, i) => ({
    date: r.date,
    revenue: r.value,
    expenses: expenses[i]?.value || 0,
  }));
}
