import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
 import { useRealtimeProducts } from './useRealtimeSubscription';

type Product = Tables<'products'>;
type ProductInsert = TablesInsert<'products'>;
type ProductUpdate = TablesUpdate<'products'>;

// Optimized hook with TanStack Query caching
export function useProducts(shopId: string | null) {
  const queryClient = useQueryClient();

   // Enable real-time updates
   useRealtimeProducts(shopId);
 
  const { data: products = [], isLoading: loading, error } = useQuery({
    queryKey: ['products', 'shop', shopId],
    queryFn: async () => {
      if (!shopId) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!shopId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: ProductInsert) => {
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'shop', shopId] });
      queryClient.invalidateQueries({ queryKey: ['products', 'public'] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ProductUpdate }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'shop', shopId] });
      queryClient.invalidateQueries({ queryKey: ['products', 'public'] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'shop', shopId] });
      queryClient.invalidateQueries({ queryKey: ['products', 'public'] });
    },
  });

  return {
    products,
    loading,
    error: error?.message || null,
    createProduct: createProductMutation.mutateAsync,
    updateProduct: (id: string, updates: ProductUpdate) => 
      updateProductMutation.mutateAsync({ id, updates }),
    deleteProduct: deleteProductMutation.mutateAsync,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['products', 'shop', shopId] }),
  };
}

// Public products with caching and ratings
export function usePublicProducts(filters?: {
  categoryId?: string;
  shopId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}) {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: loading, error } = useQuery({
    queryKey: ['products', 'public', filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, shop:shops(name, slug)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.shopId) {
        query = query.eq('shop_id', filters.shopId);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      if (filters?.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }
      if (filters?.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch ratings for all products
      if (data && data.length > 0) {
        const productIds = data.map(p => p.id);
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('product_id, rating')
          .in('product_id', productIds);
        
        // Calculate ratings per product
        const ratingsMap = new Map<string, { total: number; count: number }>();
        reviewsData?.forEach(review => {
          const existing = ratingsMap.get(review.product_id) || { total: 0, count: 0 };
          existing.total += review.rating;
          existing.count += 1;
          ratingsMap.set(review.product_id, existing);
        });
        
        // Attach ratings to products
        return data.map(product => {
          const ratingInfo = ratingsMap.get(product.id);
          return {
            ...product,
            rating: ratingInfo ? ratingInfo.total / ratingInfo.count : undefined,
            reviews_count: ratingInfo?.count || 0,
          };
        });
      }
      
      return data || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes for public data
  });

  return { 
    products, 
    loading, 
    error: error?.message || null, 
    refetch: () => queryClient.invalidateQueries({ queryKey: ['products', 'public', filters] })
  };
}
