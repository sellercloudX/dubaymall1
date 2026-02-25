import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { setRubToUzs } from '@/lib/currency';

/**
 * Fetches real RUB→UZS rate from CBU.uz (Central Bank of Uzbekistan)
 * and updates the global currency module.
 */
export function useExchangeRate() {
  return useQuery({
    queryKey: ['exchange-rate-rub-uzs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-exchange-rate');
      
      if (error) {
        console.warn('Exchange rate fetch failed, using fallback:', error);
        return { rubToUzs: 140, source: 'fallback', date: '' };
      }

      const rate = data?.rubToUzs || 140;
      console.log(`Exchange rate loaded: 1 RUB = ${rate} UZS (${data?.source}, ${data?.date})`);
      
      // Update global currency module
      setRubToUzs(rate);
      
      return {
        rubToUzs: rate,
        source: data?.source || 'fallback',
        date: data?.date || '',
      };
    },
    staleTime: 1000 * 60 * 60 * 4, // 4 hours
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 60 * 60 * 4, // refresh every 4 hours
  });
}
