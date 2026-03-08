import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Crown, Zap, DollarSign } from 'lucide-react';

export function AdminStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats-v2'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const [usersRes, subsRes, aiRes, revenueRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('sellercloud_subscriptions').select('id, is_active, monthly_fee, plan_type'),
        supabase.from('ai_usage_log').select('estimated_cost_usd'),
        supabase.from('platform_revenue').select('amount').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      const activeSubs = subsRes.data?.filter(s => s.is_active) || [];
      // MRR: use real plan prices, not monthly_fee field (which is often 0 for legacy)
      const PLAN_MRR: Record<string, number> = { premium: 1_270_000, enterprise: 6_400_000, elegant: 6_400_000 };
      const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_MRR[(s as any).plan_type] || 99_000), 0);
      const monthlyRevenue = revenueRes.data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
      const aiCost = aiRes.data?.reduce((sum, a) => sum + (a.estimated_cost_usd || 0), 0) || 0;

      return {
        usersCount: usersRes.count || 0,
        activeSubs: activeSubs.length,
        totalSubs: subsRes.data?.length || 0,
        mrr,
        monthlyRevenue,
        aiCost,
        aiActions: aiRes.data?.length || 0,
      };
    },
  });

  if (isLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="pt-6">
            <div className="h-16 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  const conversionRate = (stats?.usersCount || 0) > 0 
    ? ((stats?.activeSubs || 0) / (stats?.usersCount || 1) * 100).toFixed(1) 
    : '0';

  const statItems = [
    { label: 'Foydalanuvchilar', value: stats?.usersCount || 0, icon: Users, color: 'text-blue-500', sub: `${conversionRate}% konversiya` },
    { label: 'Faol obunalar', value: `${stats?.activeSubs || 0}/${stats?.totalSubs || 0}`, icon: Crown, color: 'text-amber-500', sub: `${stats?.totalSubs ? ((stats.activeSubs / stats.totalSubs) * 100).toFixed(0) : 0}% faol` },
    { label: 'MRR (kutilayotgan)', value: `${((stats?.mrr || 0) / 1e6).toFixed(1)} mln`, icon: DollarSign, color: 'text-emerald-500', sub: `Bu oy: ${((stats?.monthlyRevenue || 0) / 1e6).toFixed(1)} mln so'm` },
    { label: 'AI rasxodi', value: `$${(stats?.aiCost || 0).toFixed(2)}`, icon: Zap, color: 'text-orange-500', sub: `${stats?.aiActions || 0} amal` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item, idx) => (
        <Card key={idx}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
