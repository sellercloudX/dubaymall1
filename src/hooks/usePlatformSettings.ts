import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SalesCommissionSettings {
  percent: number;
  is_promo: boolean;
  promo_percent: number;
  promo_end_date: string | null;
}

export interface SubscriptionPlan {
  price: number;
  name: string;
  features: string[];
  product_limit: number;
}

export interface SubscriptionPlans {
  basic: SubscriptionPlan;
  pro: SubscriptionPlan;
  enterprise: SubscriptionPlan;
}

export interface PromoPeriod {
  is_active: boolean;
  name: string;
  start_date: string | null;
  end_date: string | null;
  free_subscription: boolean;
  zero_commission: boolean;
}

export function usePlatformSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach((item: any) => {
        settingsMap[item.setting_key] = item.setting_value;
      });

      return {
        salesCommission: settingsMap['sales_commission'] as SalesCommissionSettings,
        subscriptionPlans: settingsMap['subscription_plans'] as SubscriptionPlans,
        promoPeriod: settingsMap['promo_period'] as PromoPeriod,
      };
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from('platform_settings')
        .update({ setting_value: value })
        .eq('setting_key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast({
        title: 'Saqlandi!',
        description: 'Sozlamalar muvaffaqiyatli yangilandi',
      });
    },
    onError: (error) => {
      toast({
        title: 'Xatolik',
        description: 'Sozlamalarni saqlashda xatolik yuz berdi',
        variant: 'destructive',
      });
      console.error('Update setting error:', error);
    },
  });

  // Get effective commission rate (considering promo period)
  const getEffectiveCommission = () => {
    if (!settings?.salesCommission) return 5;
    
    const { percent, is_promo, promo_percent, promo_end_date } = settings.salesCommission;
    
    if (is_promo && promo_end_date) {
      const endDate = new Date(promo_end_date);
      if (endDate > new Date()) {
        return promo_percent;
      }
    }
    
    // Check global promo period
    if (settings?.promoPeriod?.is_active && settings?.promoPeriod?.zero_commission) {
      const endDate = settings.promoPeriod.end_date ? new Date(settings.promoPeriod.end_date) : null;
      if (!endDate || endDate > new Date()) {
        return 0;
      }
    }
    
    return percent;
  };

  return {
    settings,
    isLoading,
    updateSetting,
    getEffectiveCommission,
  };
}
