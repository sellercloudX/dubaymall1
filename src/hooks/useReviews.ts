import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useProductReviews(productId: string) {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: async () => {
      // First get reviews
      const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!reviews?.length) return [];

      // Get unique user IDs
      const userIds = [...new Set(reviews.map(r => r.user_id))];

      // Fetch profiles for those users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      // Map profiles to reviews
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return reviews.map(review => ({
        ...review,
        profiles: profileMap.get(review.user_id) || null,
      })) as Review[];
    },
    enabled: !!productId,
  });
}

export function useProductRating(productId: string) {
  return useQuery({
    queryKey: ['product-rating', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_product_rating', { p_product_id: productId });

      if (error) throw error;
      return data?.[0] || { average_rating: 0, total_reviews: 0 };
    },
    enabled: !!productId,
  });
}

export function useAddReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, rating, comment }: { productId: string; rating: number; comment?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if user has purchased this product
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, orders!inner(user_id, status)')
        .eq('product_id', productId)
        .eq('orders.user_id', user.id)
        .eq('orders.status', 'delivered')
        .limit(1);

      const isVerifiedPurchase = (orderItems?.length || 0) > 0;

      const { data, error } = await supabase
        .from('reviews')
        .insert({
          product_id: productId,
          user_id: user.id,
          rating,
          comment: comment || null,
          is_verified_purchase: isVerifiedPurchase,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['product-rating', variables.productId] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, productId }: { reviewId: string; productId: string }) => {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['product-rating', productId] });
    },
  });
}

export function useUserReview(productId: string, userId?: string) {
  return useQuery({
    queryKey: ['user-review', productId, userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!userId,
  });
}
