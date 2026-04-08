import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  name_uz: string | null;
  name_ru: string | null;
  description: string | null;
  description_uz: string | null;
  description_ru: string | null;
  onetime_price_uzs?: number;
  monthly_fee_uzs: number;
  max_stores_per_marketplace: number;
  free_card_creation_monthly: number;
  free_cloning_monthly: number;
  balance_discount_percent: number;
  included_feature_keys: string[];
  data_retention_days: number;
  is_active: boolean;
  sort_order: number;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscriptionPlans(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['subscription-plans'],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });
}

export function useAdminSubscriptionPlans() {
  const queryClient = useQueryClient();

  const updatePlan = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SubscriptionPlan> }) => {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Tarif yangilandi');
    },
    onError: (err: any) => toast.error('Xatolik: ' + err.message),
  });

  const createPlan = useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan>) => {
      const { error } = await supabase
        .from('subscription_plans')
        .insert(plan as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Yangi tarif qo\'shildi');
    },
    onError: (err: any) => toast.error('Xatolik: ' + err.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Tarif o\'chirildi');
    },
    onError: (err: any) => toast.error('Xatolik: ' + err.message),
  });

  return { updatePlan, createPlan, deletePlan };
}
