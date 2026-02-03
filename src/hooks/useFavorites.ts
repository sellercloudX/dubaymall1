import { useState, useEffect, useCallback } from 'react';
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
  const [favorites, setFavorites] = useState<FavoriteWithProduct[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
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

    if (error) {
      console.error('Error fetching favorites:', error);
    } else {
      const typedData = data as unknown as FavoriteWithProduct[];
      setFavorites(typedData || []);
      setFavoriteIds(new Set(typedData?.map(f => f.product_id) || []));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addToFavorites = async (productId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, product_id: productId });

    if (error) {
      console.error('Error adding to favorites:', error);
      return false;
    }

    setFavoriteIds(prev => new Set([...prev, productId]));
    await fetchFavorites();
    return true;
  };

  const removeFromFavorites = async (productId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    if (error) {
      console.error('Error removing from favorites:', error);
      return false;
    }

    setFavoriteIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(productId);
      return newSet;
    });
    await fetchFavorites();
    return true;
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
    refetch: fetchFavorites,
  };
}
