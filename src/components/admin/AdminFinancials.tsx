import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Crown, Users, PieChart } from 'lucide-react';
import { format } from 'date-fns';

const USD_RATE = 12800;

export function AdminFinancials() {
  // Platform revenue with source_id to identify partners
  const { data: revenueStats, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin-revenue-stats-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_revenue')
        .select('amount, source_type, source_id, created_at, description')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const total = data?.reduce((sum, r) => sum + r.amount, 0) || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRevenue = data?.filter(r => new Date(r.created_at) >= today)
        .reduce((sum, r) => sum + r.amount, 0) || 0;

      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const monthRevenue = data?.filter(r => new Date(r.created_at) >= thisMonth)
        .reduce((sum, r) => sum + r.amount, 0) || 0;

      // Group by source_type
      const bySource: Record<string, number> = {};
      data?.forEach(r => {
        bySource[r.source_type] = (bySource[r.source_type] || 0) + r.amount;
      });

      return { total, todayRevenue, monthRevenue, records: data || [], bySource };
    },
  });

  // Subscription + billing data for per-partner revenue
  const { data: partnerRevenue } = useQuery({
    queryKey: ['admin-partner-revenue'],
    queryFn: async () => {
      const [subsRes, billRes, profilesRes] = await Promise.all([
        supabase.from('sellercloud_subscriptions').select('id, user_id, is_active, monthly_fee, plan_type'),
        supabase.from('sellercloud_billing').select('user_id, total_paid, total_due, balance_due, status'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      const profileMap: Record<string, string> = {};
      profilesRes.data?.forEach(p => { profileMap[p.user_id] = p.full_name || 'Nomsiz'; });

      const partnerMap: Record<string, { name: string; paid: number; debt: number; plan: string; active: boolean }> = {};
      subsRes.data?.forEach(s => {
        partnerMap[s.user_id] = {
          name: profileMap[s.user_id] || s.user_id.slice(0, 8),
          paid: 0, debt: 0,
          plan: s.plan_type || 'pro',
          active: s.is_active || false,
        };
      });
      billRes.data?.forEach(b => {
        if (!partnerMap[b.user_id]) {
          partnerMap[b.user_id] = { name: profileMap[b.user_id] || b.user_id.slice(0, 8), paid: 0, debt: 0, plan: '-', active: false };
        }
        partnerMap[b.user_id].paid += b.total_paid || 0;
        if (b.status === 'pending' || b.status === 'overdue') {
          partnerMap[b.user_id].debt += b.balance_due || 0;
        }
      });

      return Object.entries(partnerMap)
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.paid - a.paid);
    },
  });

  // Subscription MRR
  const { data: subscriptionStats } = useQuery({
    queryKey: ['admin-subscription-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellercloud_subscriptions')
        .select('id, is_active, monthly_fee, commission_percent, created_at');
      if (error) throw error;
      const activeCount = data?.filter(s => s.is_active).length || 0;
      const monthlyRevenue = data?.filter(s => s.is_active)
        .reduce((sum, s) => sum + (s.monthly_fee || 0), 0) || 0;
      return { activeCount, monthlyRevenue: monthlyRevenue * USD_RATE, total: data?.length || 0 };
    },
  });

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln so\'m';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const SOURCE_LABELS: Record<string, string> = {
    order_commission: 'Savdo komissiyasi',
    subscription: 'Obuna to\'lovi',
    cash_payment: 'Naqd to\'lov',
    billing_payment: 'Billing to\'lov',
    manual: 'Qo\'lda kiritilgan',
  };

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />Jami daromad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {revenueLoading ? '...' : formatPrice(revenueStats?.total || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Bu oy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {revenueLoading ? '...' : formatPrice(revenueStats?.monthRevenue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-100 flex items-center gap-2">
              <Crown className="h-4 w-4" />MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(subscriptionStats?.monthlyRevenue || 0)}</p>
            <p className="text-xs text-amber-200">{subscriptionStats?.activeCount || 0} faol obuna</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-violet-100 flex items-center gap-2">
              <PieChart className="h-4 w-4" />Bugun
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(revenueStats?.todayRevenue || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by source type */}
      {revenueStats?.bySource && Object.keys(revenueStats.bySource).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Daromad manbalari</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(revenueStats.bySource).sort(([,a],[,b]) => b - a).map(([source, amount]) => (
                <div key={source} className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">{SOURCE_LABELS[source] || source}</p>
                  <p className="text-lg font-bold mt-1">{formatPrice(amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-partner revenue table */}
      {partnerRevenue && partnerRevenue.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Hamkorlar bo'yicha daromad</CardTitle>
                <CardDescription className="text-xs">Har bir hamkordan kelgan to'lovlar va qarzdorliklar</CardDescription>
              </div>
              <Badge variant="secondary">{partnerRevenue.length} hamkor</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hamkor</TableHead>
                    <TableHead>Tarif</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">To'langan</TableHead>
                    <TableHead className="text-right">Qarzdorlik</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerRevenue.map(p => (
                    <TableRow key={p.userId}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.plan}</Badge></TableCell>
                      <TableCell>
                        {p.active ? (
                          <Badge className="bg-green-500 text-xs">Faol</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Nofaol</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{formatPrice(p.paid)}</TableCell>
                      <TableCell className={`text-right font-semibold ${p.debt > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {p.debt > 0 ? formatPrice(p.debt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue History */}
      <Card>
        <CardHeader>
          <CardTitle>Platform daromad tarixi</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueStats?.records && revenueStats.records.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Manba</TableHead>
                    <TableHead>Tavsif</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueStats.records.slice(0, 50).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{SOURCE_LABELS[r.source_type] || r.source_type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                        {r.description || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        +{r.amount.toLocaleString()} so'm
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Hali daromad tarixi yo'q
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
