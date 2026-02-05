import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;
type Favorite = Tables<'favorites'>;

interface FavoriteWithProduct extends Favorite {
  products: Product & { shop?: { name: string; slug: string } };
}

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return { favorites: [], favoriteIds: [] as string[] };

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          *,
          products (
            *,
            shop:shops (name, slug)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData = data as unknown as FavoriteWithProduct[];
      return {
        favorites: typedData || [],
        favoriteIds: typedData?.map(f => f.product_id) || [],
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const favorites = data?.favorites || [];
  // Always create a fresh Set to handle React Query persistence deserialization
  const favoriteIds = new Set<string>(data?.favoriteIds || []);

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, product_id: productId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  const addToFavorites = async (productId: string) => {
    try {
      await addMutation.mutateAsync(productId);
      return true;
    } catch {
      return false;
    }
  };

  const removeFromFavorites = async (productId: string) => {
    try {
      await removeMutation.mutateAsync(productId);
      return true;
    } catch {
      return false;
    }
  };

  const toggleFavorite = async (productId: string) => {
    if (favoriteIds.has(productId)) {
      return removeFromFavorites(productId);
    } else {
      return addToFavorites(productId);
    }
  };

  const isFavorite = (productId: string) => favoriteIds.has(productId);

  return {
    favorites,
    favoriteIds,
    loading,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] }),
  };
}
