import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const MIN_TOPUP_UZS = 300_000;
export const ACTIVATION_FEE_UZS = 99_000;
export const TRIAL_DAYS = 1;

export interface FeaturePrice {
  id: string;
  feature_key: string;
  feature_name: string;
  feature_name_uz: string | null;
  feature_name_ru: string | null;
  category: string;
  base_price_uzs: number;
  is_enabled: boolean;
  is_free: boolean;
  is_premium_only: boolean;
  elegant_limit: number | null;
  monthly_limit: number | null;
  billing_type: 'per_use' | 'monthly';
  description: string | null;
  sort_order: number;
}

export interface UserBalance {
  id: string;
  user_id: string;
  balance_uzs: number;
  total_deposited: number;
  total_spent: number;
}

export interface BalanceTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  feature_key: string | null;
  description: string | null;
  metadata: any;
  created_at: string;
}

export function useFeaturePricing() {
  const { data: features, isLoading } = useQuery({
    queryKey: ['feature-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_pricing')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as FeaturePrice[];
    },
  });

  const getFeaturePrice = (featureKey: string): FeaturePrice | undefined => {
    return features?.find(f => f.feature_key === featureKey);
  };

  return { features, isLoading, getFeaturePrice };
}

export function useUserBalance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: balance, isLoading } = useQuery({
    queryKey: ['user-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_balances')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserBalance | null;
    },
    enabled: !!user,
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ['balance-transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('balance_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as BalanceTransaction[];
    },
    enabled: !!user,
  });

  const checkFeatureAccess = async (featureKey: string) => {
    if (!user) return { allowed: false, error: 'not_authenticated' };
    const { data, error } = await supabase.rpc('check_feature_access', {
      p_user_id: user.id,
      p_feature_key: featureKey,
    });
    if (error) throw error;
    return data as any;
  };

  const deductBalance = async (featureKey: string, description?: string) => {
    if (!user) return { success: false, error: 'not_authenticated' };
    
    // First check access
    const access = await checkFeatureAccess(featureKey);
    if (!access.allowed) return { success: false, ...access };

    // If price is 0 (free or elegant), just track usage
    if (access.price === 0) {
      // For elegant, increment usage
      if (access.tier === 'elegant') {
        await supabase.from('elegant_usage').upsert(
          { user_id: user.id, feature_key: featureKey, usage_month: new Date().toISOString().slice(0, 7) + '-01', usage_count: (access.used || 0) + 1 },
          { onConflict: 'user_id,feature_key,usage_month' }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      return { success: true, price: 0, tier: access.tier };
    }

    // Deduct from balance
    const { data, error } = await supabase.rpc('deduct_balance', {
      p_user_id: user.id,
      p_amount: access.price,
      p_feature_key: featureKey,
      p_description: description || null,
    });
    if (error) throw error;
    
    const result = data as any;
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['balance-transactions'] });
    }
    return { ...result, price: access.price, tier: access.tier };
  };

  const payActivation = async () => {
    if (!user) return { success: false, error: 'not_authenticated' };
    // Deduct activation fee from balance
    const { data, error } = await supabase.rpc('deduct_balance', {
      p_user_id: user.id,
      p_amount: ACTIVATION_FEE_UZS,
      p_feature_key: 'monthly-activation',
      p_description: 'Oylik aktivatsiya to\'lovi',
    });
    if (error) throw error;
    const result = data as any;
    if (result.success) {
      // Update subscription activation_paid_until
      await supabase
        .from('sellercloud_subscriptions')
        .update({ activation_paid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('user_id', user.id);
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['balance-transactions'] });
      toast.success('Oylik aktivatsiya muvaffaqiyatli to\'landi!');
    }
    return result;
  };

  return {
    balance,
    isLoading,
    transactions,
    loadingTx,
    checkFeatureAccess,
    deductBalance,
    payActivation,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['user-balance'] }),
  };
}

// Admin hook for managing feature pricing and balances
export function useAdminFeaturePricing() {
  const queryClient = useQueryClient();

  const updateFeature = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FeaturePrice> }) => {
      const { error } = await supabase
        .from('feature_pricing')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-pricing'] });
      toast.success('Funksiya narxi yangilandi');
    },
    onError: (err: any) => toast.error('Xatolik: ' + err.message),
  });

  const addBalanceToUser = useMutation({
    mutationFn: async ({ userId, amount, description }: { userId: string; amount: number; description?: string }) => {
      const { data, error } = await supabase.rpc('add_balance', {
        p_user_id: userId,
        p_amount: amount,
        p_type: 'admin_topup',
        p_description: description || 'Admin tomonidan to\'ldirildi',
        p_metadata: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      toast.success('Balans to\'ldirildi');
    },
    onError: (err: any) => toast.error('Xatolik: ' + err.message),
  });

  // Get all user balances (admin)
  const { data: allBalances, isLoading: loadingBalances } = useQuery({
    queryKey: ['admin-all-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_balances')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as UserBalance[];
    },
  });

  return {
    updateFeature,
    addBalanceToUser,
    allBalances,
    loadingBalances,
  };
}
