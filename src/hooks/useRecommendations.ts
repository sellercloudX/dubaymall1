import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

interface ProductWithShop extends Product {
  shop?: { name: string; slug: string };
}

export function useRecommendations(currentProductId?: string, limit: number = 8) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<ProductWithShop[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);

    try {
      // Strategy 1: If viewing a product, get similar products by category
      if (currentProductId) {
        // First get the current product's category
        const { data: currentProduct } = await supabase
          .from('products')
          .select('category_id, shop_id')
          .eq('id', currentProductId)
          .single();

        if (currentProduct?.category_id) {
          // Get products in the same category
          const { data: similarProducts } = await supabase
            .from('products')
            .select('*, shop:shops(name, slug)')
            .eq('category_id', currentProduct.category_id)
            .eq('status', 'active')
            .neq('id', currentProductId)
            .order('view_count', { ascending: false })
            .limit(limit);

          if (similarProducts && similarProducts.length > 0) {
            setRecommendations(similarProducts as unknown as ProductWithShop[]);
            setLoading(false);
            return;
          }
        }
      }

      // Strategy 2: For logged-in users, recommend based on their activity
      if (user) {
        // Get user's favorite categories from their favorites and cart
        const { data: favorites } = await supabase
          .from('favorites')
          .select('product_id, products(category_id)')
          .eq('user_id', user.id)
          .limit(10);

        const favoriteCategories = favorites
          ?.map(f => (f.products as any)?.category_id)
          .filter(Boolean) || [];

        if (favoriteCategories.length > 0) {
          // Get popular products from favorite categories
          let recQuery = supabase
            .from('products')
            .select('*, shop:shops(name, slug)')
            .in('category_id', favoriteCategories)
            .eq('status', 'active')
            .order('view_count', { ascending: false })
            .limit(limit);
          
          if (currentProductId) {
            recQuery = recQuery.neq('id', currentProductId);
          }
            
          const { data: recommendedProducts } = await recQuery;

          if (recommendedProducts && recommendedProducts.length > 0) {
            setRecommendations(recommendedProducts as unknown as ProductWithShop[]);
            setLoading(false);
            return;
          }
        }
      }

      // Strategy 3: Fallback - get trending/popular products
      let query = supabase
        .from('products')
        .select('*, shop:shops(name, slug)')
        .eq('status', 'active')
        .order('view_count', { ascending: false })
        .limit(limit);
      
      if (currentProductId) {
        query = query.neq('id', currentProductId);
      }
        
      const { data: trendingProducts } = await query;

      setRecommendations((trendingProducts as unknown as ProductWithShop[]) || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setRecommendations([]);
    }

    setLoading(false);
  }, [currentProductId, user, limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return { recommendations, loading, refetch: fetchRecommendations };
}

// Hook for "Recently Viewed" products
export function useRecentlyViewed(limit: number = 8) {
  const [recentProducts, setRecentProducts] = useState<ProductWithShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecent = async () => {
      // Get from localStorage
      const recentIds = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      
      if (recentIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('products')
        .select('*, shop:shops(name, slug)')
        .in('id', recentIds.slice(0, limit))
        .eq('status', 'active');

      // Sort by the order in localStorage
      const sorted = recentIds
        .map((id: string) => data?.find(p => p.id === id))
        .filter(Boolean);

      setRecentProducts(sorted as unknown as ProductWithShop[]);
      setLoading(false);
    };

    fetchRecent();
  }, [limit]);

  const addToRecentlyViewed = (productId: string) => {
    const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    const filtered = recent.filter((id: string) => id !== productId);
    const updated = [productId, ...filtered].slice(0, 20);
    localStorage.setItem('recentlyViewed', JSON.stringify(updated));
  };

  return { recentProducts, loading, addToRecentlyViewed };
}
