import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/hooks/useShop';
import { toast } from 'sonner';

export function useSellerBalance() {
  const { shop } = useShop();
  const queryClient = useQueryClient();

  const { data: balance, isLoading } = useQuery({
    queryKey: ['seller-balance', shop?.id],
    queryFn: async () => {
      if (!shop) return null;

      const { data, error } = await supabase
        .from('seller_balances')
        .select('*')
        .eq('shop_id', shop.id)
        .maybeSingle();

      if (error) throw error;
      
      // Calculate total withdrawn from withdrawal requests
      const { data: withdrawalsData } = await supabase
        .from('seller_withdrawal_requests')
        .select('amount')
        .eq('shop_id', shop.id)
        .eq('status', 'completed');
      
      const totalWithdrawn = withdrawalsData?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
      
      return { ...data, total_withdrawn: totalWithdrawn };
    },
    enabled: !!shop,
  });

  const { data: financials, isLoading: financialsLoading } = useQuery({
    queryKey: ['seller-financials', shop?.id],
    queryFn: async () => {
      if (!shop) return [];

      const { data, error } = await supabase
        .from('order_financials')
        .select(`
          *,
          orders (order_number, status, delivery_confirmed_at, created_at)
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!shop,
  });

  const { data: withdrawals, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ['seller-withdrawals', shop?.id],
    queryFn: async () => {
      if (!shop) return [];

      const { data, error } = await supabase
        .from('seller_withdrawal_requests')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!shop,
  });

  const createWithdrawal = useMutation({
    mutationFn: async (data: {
      amount: number;
      payment_method: string;
      payment_details: any;
    }) => {
      if (!shop) throw new Error('Do\'kon topilmadi');
      if (!balance || data.amount > (balance.available_balance || 0)) {
        throw new Error('Yetarli mablag\' yo\'q');
      }

      const { error } = await supabase
        .from('seller_withdrawal_requests')
        .insert({
          shop_id: shop.id,
          amount: data.amount,
          payment_method: data.payment_method,
          payment_details: data.payment_details,
        });

      if (error) throw error;

      // Update balance (move from available to pending withdrawal)
      await supabase
        .from('seller_balances')
        .update({
          available_balance: (balance.available_balance || 0) - data.amount,
        })
        .eq('shop_id', shop.id);
    },
    onSuccess: () => {
      toast.success('Pul yechish so\'rovi yuborildi!');
      queryClient.invalidateQueries({ queryKey: ['seller-balance'] });
      queryClient.invalidateQueries({ queryKey: ['seller-withdrawals'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Xatolik yuz berdi');
    },
  });

  return {
    balance,
    financials,
    withdrawals,
    isLoading: isLoading || financialsLoading || withdrawalsLoading,
    createWithdrawal,
  };
}
