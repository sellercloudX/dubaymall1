import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Tables } from '@/integrations/supabase/types';

type Category = Tables<'categories'>;

export interface CategoryWithName extends Category {
  name: string;
}

// Optimized with TanStack Query caching
export function useCategories() {
  const { language } = useLanguage();

  const { data: categories = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['categories', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name_uz');

      if (error) throw error;

      return (data || []).map(cat => ({
        ...cat,
        name: language === 'uz' ? cat.name_uz : language === 'ru' ? cat.name_ru : cat.name_en,
      }));
    },
    staleTime: 1000 * 60 * 10, // Categories rarely change - 10 minutes cache
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
  });

  return { categories, loading, error: error?.message || null, refetch };
}
