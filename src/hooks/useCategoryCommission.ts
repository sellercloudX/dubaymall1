 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { usePlatformSettings } from './usePlatformSettings';
 
 export function useCategoryCommission() {
   const { getEffectiveCommission } = usePlatformSettings();
   const baseCommission = getEffectiveCommission();
 
   const { data: categoryCommissions } = useQuery({
     queryKey: ['category-commissions'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('category_commissions')
         .select('category_id, commission_percent, is_active');
 
       if (error) throw error;
       return data || [];
     },
   });
 
   // Get total commission for a specific category
   const getCommissionForCategory = (categoryId: string | null): number => {
     if (!categoryId) return baseCommission;
 
     const categoryRate = categoryCommissions?.find(
       (c) => c.category_id === categoryId && c.is_active
     );
 
     if (!categoryRate) return baseCommission;
 
     return baseCommission + Number(categoryRate.commission_percent);
   };
 
   // Calculate platform commission amount for an order
   const calculateCommission = (
     orderTotal: number,
     categoryId: string | null
   ): { percent: number; amount: number } => {
     const percent = getCommissionForCategory(categoryId);
     const amount = orderTotal * (percent / 100);
     return { percent, amount };
   };
 
   return {
     baseCommission,
     categoryCommissions,
     getCommissionForCategory,
     calculateCommission,
   };
 }