import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSellerStats } from '@/hooks/useSellerStats';
import { useCategoryCommission } from '@/hooks/useCategoryCommission';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface SellerPnLProps {
  shopId: string;
}

export function SellerPnL({ shopId }: SellerPnLProps) {
  const { data: stats, isLoading } = useSellerStats(shopId);
  const { baseCommission } = useCategoryCommission();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const commissionRate = baseCommission || 5;
  const platformCommission = stats.totalRevenue * (commissionRate / 100);
  const netRevenue = stats.totalRevenue - platformCommission;
  const profitMargin = stats.totalRevenue > 0 ? (netRevenue / stats.totalRevenue) * 100 : 0;

  const formatCurrency = (value: number) => `${value.toLocaleString()} so'm`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
  };

  // Calculate daily net profit
  const profitByDay = stats.revenueByDay.map(day => ({
    ...day,
    commission: day.revenue * (commissionRate / 100),
    netProfit: day.revenue * (1 - commissionRate / 100),
  }));

  // Revenue breakdown for pie chart
  const breakdownData = [
    { name: 'Sof foyda', value: netRevenue, color: 'hsl(var(--primary))' },
    { name: 'Platforma komissiyasi', value: platformCommission, color: 'hsl(var(--destructive))' },
  ];

  // Trend calculation (compare last 3 days vs prior 3 days)
  const recentDays = stats.revenueByDay.slice(-3);
  const priorDays = stats.revenueByDay.slice(-6, -3);
  const recentAvg = recentDays.reduce((s, d) => s + d.revenue, 0) / (recentDays.length || 1);
  const priorAvg = priorDays.reduce((s, d) => s + d.revenue, 0) / (priorDays.length || 1);
  const trendPercent = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* PnL Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-emerald-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Umumiy daromad</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <div className="flex items-center gap-1 mt-1">
              {trendPercent > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : trendPercent < 0 ? (
                <ArrowDownRight className="h-3 w-3 text-destructive" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={`text-xs ${trendPercent > 0 ? 'text-emerald-500' : trendPercent < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {Math.abs(trendPercent).toFixed(1)}% haftalik trend
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Komissiya ({commissionRate}%)</CardTitle>
            <Percent className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">-{formatCurrency(Math.round(platformCommission))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Platforma ulushi
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sof foyda</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">{formatCurrency(Math.round(netRevenue))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Komissiyadan keyin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marja</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{profitMargin.toFixed(1)}%</div>
            <Badge variant={profitMargin >= 80 ? 'default' : profitMargin >= 50 ? 'secondary' : 'destructive'} className="mt-1">
              {profitMargin >= 80 ? 'Yaxshi' : profitMargin >= 50 ? "O'rtacha" : 'Past'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Net Profit Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Kunlik sof foyda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profitByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={profitByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(Math.round(value)),
                      name === 'netProfit' ? 'Sof foyda' : name === 'commission' ? 'Komissiya' : 'Daromad',
                    ]}
                    labelFormatter={formatDate}
                  />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted) / 0.3)" name="revenue" />
                  <Area type="monotone" dataKey="netProfit" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" name="netProfit" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                Ma'lumot yo'q
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Daromad taqsimoti
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalRevenue > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={breakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="value"
                    >
                      {breakdownData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(Math.round(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {breakdownData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(Math.round(item.value))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-muted-foreground">
                Hali sotuvlar yo'q
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products PnL Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Mahsulotlar bo'yicha foyda
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topProducts.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground pb-2 border-b">
                <span>Mahsulot</span>
                <span className="text-right">Daromad</span>
                <span className="text-right">Komissiya</span>
                <span className="text-right">Sof foyda</span>
              </div>
              {stats.topProducts.map((product) => {
                const commission = product.revenue * (commissionRate / 100);
                const net = product.revenue - commission;
                return (
                  <div key={product.id} className="grid grid-cols-4 items-center text-sm py-2 border-b border-muted/50 last:border-0">
                    <span className="font-medium truncate pr-2">{product.name}</span>
                    <span className="text-right">{formatCurrency(Math.round(product.revenue))}</span>
                    <span className="text-right text-destructive">-{formatCurrency(Math.round(commission))}</span>
                    <span className="text-right font-semibold text-primary">{formatCurrency(Math.round(net))}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Hali sotuvlar yo'q
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
