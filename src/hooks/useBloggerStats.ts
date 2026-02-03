import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BloggerStats {
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalClicks: number;
  totalConversions: number;
}

export default function useBloggerStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<BloggerStats>({
    availableBalance: 0,
    pendingBalance: 0,
    totalEarned: 0,
    totalClicks: 0,
    totalConversions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);

      // Fetch balance
      const { data: balanceData } = await supabase
        .from('blogger_balances')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch affiliate links stats
      const { data: linksData } = await supabase
        .from('affiliate_links')
        .select('clicks, conversions')
        .eq('blogger_id', user.id);

      const totalClicks = linksData?.reduce((sum, link) => sum + (link.clicks || 0), 0) || 0;
      const totalConversions = linksData?.reduce((sum, link) => sum + (link.conversions || 0), 0) || 0;

      setStats({
        availableBalance: balanceData?.available_balance || 0,
        pendingBalance: balanceData?.pending_balance || 0,
        totalEarned: balanceData?.total_earned || 0,
        totalClicks,
        totalConversions,
      });

      setLoading(false);
    };

    fetchStats();
  }, [user]);

  return { stats, loading };
}
