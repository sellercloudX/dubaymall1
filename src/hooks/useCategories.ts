import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Tables } from '@/integrations/supabase/types';

type Category = Tables<'categories'>;

export interface CategoryWithName extends Category {
  name: string;
}

export function useCategories() {
  const { language } = useLanguage();
  const [categories, setCategories] = useState<CategoryWithName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [language]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name_uz');

    if (error) {
      setError(error.message);
    } else {
      const categoriesWithName = (data || []).map(cat => ({
        ...cat,
        name: language === 'uz' ? cat.name_uz : language === 'ru' ? cat.name_ru : cat.name_en,
      }));
      setCategories(categoriesWithName);
    }
    setLoading(false);
  };

  return { categories, loading, error, refetch: fetchCategories };
}