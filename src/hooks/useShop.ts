import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Shop = Tables<'shops'>;
type ShopInsert = TablesInsert<'shops'>;

export function useShop() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: shop = null, isLoading: loading, error } = useQuery({
    queryKey: ['shop', 'user', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const createShopMutation = useMutation({
    mutationFn: async (shopData: Omit<ShopInsert, 'user_id'>) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('shops')
        .insert({
          ...shopData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'user', user?.id] });
    },
  });

  const updateShopMutation = useMutation({
    mutationFn: async (updates: Partial<Shop>) => {
      if (!shop) throw new Error('No shop to update');

      const { data, error } = await supabase
        .from('shops')
        .update(updates)
        .eq('id', shop.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'user', user?.id] });
    },
  });

  return {
    shop,
    loading,
    error: error?.message || null,
    createShop: createShopMutation.mutateAsync,
    updateShop: updateShopMutation.mutateAsync,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['shop', 'user', user?.id] }),
  };
}

export function useShopBySlug(slug: string) {
  const { data: shop = null, isLoading: loading, error } = useQuery({
    queryKey: ['shop', 'slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops_public')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });

  return { shop, loading, error: error?.message || null };
}
