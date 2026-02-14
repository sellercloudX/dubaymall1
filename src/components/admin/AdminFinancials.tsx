import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, Crown } from 'lucide-react';
import { format } from 'date-fns';

const USD_RATE = 12800;

export function AdminFinancials() {
  // Platform revenue summary
  const { data: revenueStats, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin-revenue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_revenue')
        .select('amount, source_type, created_at, description')
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

      return { total, todayRevenue, monthRevenue, records: data || [] };
    },
  });

  // Subscription revenue
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

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Jami daromad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {revenueLoading ? '...' : `${(revenueStats?.total || 0).toLocaleString()} so'm`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Bu oy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {revenueLoading ? '...' : `${(revenueStats?.monthRevenue || 0).toLocaleString()} so'm`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-100 flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Oylik obuna (MRR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(subscriptionStats?.monthlyRevenue || 0).toLocaleString()} so'm
            </p>
            <p className="text-xs text-amber-200">{subscriptionStats?.activeCount || 0} faol obuna</p>
          </CardContent>
        </Card>
      </div>

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
                      <TableCell className="text-muted-foreground">
                        {format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="capitalize">{r.source_type}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
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
