import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Crown, Zap, DollarSign } from 'lucide-react';

const USD_RATE = 12800;

export function AdminStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats-v2'],
    queryFn: async () => {
      const [usersRes, subsRes, aiRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('sellercloud_subscriptions').select('id, is_active, monthly_fee'),
        supabase.from('ai_usage_log').select('estimated_cost_usd'),
      ]);

      const activeSubs = subsRes.data?.filter(s => s.is_active) || [];
      const mrr = activeSubs.reduce((sum, s) => sum + (s.monthly_fee || 0) * USD_RATE, 0);
      const aiCost = aiRes.data?.reduce((sum, a) => sum + (a.estimated_cost_usd || 0), 0) || 0;

      return {
        usersCount: usersRes.count || 0,
        activeSubs: activeSubs.length,
        totalSubs: subsRes.data?.length || 0,
        mrr,
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

  const statItems = [
    { label: 'Foydalanuvchilar', value: stats?.usersCount || 0, icon: Users, color: 'text-blue-500' },
    { label: 'Faol obunalar', value: `${stats?.activeSubs || 0}/${stats?.totalSubs || 0}`, icon: Crown, color: 'text-amber-500' },
    { label: 'MRR', value: `${((stats?.mrr || 0) / 1e6).toFixed(1)} mln`, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'AI rasxodi', value: `$${(stats?.aiCost || 0).toFixed(2)}`, icon: Zap, color: 'text-orange-500' },
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
