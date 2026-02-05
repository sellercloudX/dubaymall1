import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_type: 'size' | 'color' | 'model';
  variant_value: string;
  variant_label: string | null;
  price_adjustment: number;
  stock_quantity: number;
  image_url: string | null;
  hex_color: string | null;
  sort_order: number;
  is_active: boolean;
}

export function useProductVariants(productId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: variants = [], isLoading, error } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as ProductVariant[];
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });

  // Group variants by type
  const variantsByType = variants.reduce((acc, variant) => {
    if (!acc[variant.variant_type]) {
      acc[variant.variant_type] = [];
    }
    acc[variant.variant_type].push(variant);
    return acc;
  }, {} as Record<string, ProductVariant[]>);

  const createVariant = useMutation({
    mutationFn: async (variant: Omit<ProductVariant, 'id'>) => {
      const { data, error } = await supabase
        .from('product_variants')
        .insert(variant)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
    },
  });

  const updateVariant = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductVariant> }) => {
      const { data, error } = await supabase
        .from('product_variants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
    },
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
    },
  });

  return {
    variants,
    variantsByType,
    isLoading,
    error: error?.message || null,
    createVariant: createVariant.mutateAsync,
    updateVariant: updateVariant.mutateAsync,
    deleteVariant: deleteVariant.mutateAsync,
    hasColors: !!variantsByType.color?.length,
    hasSizes: !!variantsByType.size?.length,
    hasModels: !!variantsByType.model?.length,
  };
}
