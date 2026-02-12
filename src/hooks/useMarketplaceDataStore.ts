import { useQueries, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { marketplaceQueue } from '@/lib/requestQueue';

export interface MarketplaceProduct {
  offerId: string;
  name: string;
  price?: number;
  shopSku?: string;
  category?: string;
  marketCategoryId?: number;
  pictures?: string[];
  description?: string;
  availability?: string;
  stockFBO?: number;
  stockFBS?: number;
  stockCount?: number;
}

export interface MarketplaceOrder {
  id: number;
  status: string;
  substatus?: string;
  createdAt: string;
  total: number;
  totalUZS: number;
  itemsTotal: number;
  itemsTotalUZS: number;
  deliveryTotal: number;
  deliveryTotalUZS: number;
  buyer?: {
    firstName?: string;
    lastName?: string;
  };
  items?: Array<{
    offerId: string;
    offerName: string;
    count: number;
    price: number;
    priceUZS: number;
  }>;
}

// Shared fetch function
async function fetchMarketplaceDataFn(
  marketplace: string,
  dataType: string,
  options: Record<string, any> = {}
) {
  return marketplaceQueue.add(
    async () => {
      const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
        body: { marketplace, dataType, ...options },
      });
      if (error) throw error;
      return data;
    },
    { id: `${marketplace}-${dataType}`, priority: dataType === 'orders' ? 2 : 1 }
  );
}

/**
 * Centralized marketplace data store.
 * Fetches products and orders for ALL connected marketplaces using TanStack Query.
 * Data is cached (10min products, 5min orders) and shared across all tab components.
 * Tab switching uses cached data — no re-fetching.
 */
export function useMarketplaceDataStore(connectedMarketplaces: string[]) {
   const queryClient = useQueryClient();

   // Stable marketplace list to prevent unnecessary re-renders
   const memoizedMarketplaces = JSON.stringify(connectedMarketplaces.sort());

   // Fetch products for each marketplace
   const productQueries = useQueries({
     queries: connectedMarketplaces.map(mp => ({
       queryKey: ['marketplace-products', mp],
       queryFn: async () => {
         const result = await fetchMarketplaceDataFn(mp, 'products', {
           limit: 200,
           fetchAll: true,
         });
         // Server already deduplicates by offerId — just ensure no client-side duplicates
         const raw = (result.data || []) as MarketplaceProduct[];
         const seen = new Set<string>();
         const deduped: MarketplaceProduct[] = [];
         for (const p of raw) {
           const key = p.offerId || p.shopSku;
           if (!key || seen.has(key)) continue;
           seen.add(key);
           deduped.push(p);
         }
         return {
           marketplace: mp,
           data: deduped,
           total: deduped.length,
         };
       },
       staleTime: 1000 * 60 * 30, // 30 min — prevent refetch on mount
       gcTime: 1000 * 60 * 60 * 24, // 24h cache
       refetchOnWindowFocus: false,
       refetchOnMount: false, // Don't refetch when component mounts
       refetchInterval: 1000 * 60 * 10, // Auto-refresh every 10 min in background
       retry: 2,
       retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
       networkMode: 'offlineFirst' as const,
     })),
   });

   // Fetch orders for each marketplace
   const orderQueries = useQueries({
     queries: connectedMarketplaces.map(mp => ({
       queryKey: ['marketplace-orders', mp],
       queryFn: async () => {
         const result = await fetchMarketplaceDataFn(mp, 'orders', {
           fetchAll: true,
         });
         return {
           marketplace: mp,
           data: (result.data || []) as MarketplaceOrder[],
           total: result.data?.length || 0,
         };
       },
       staleTime: 1000 * 60 * 30, // 30 min — prevent refetch on mount
       gcTime: 1000 * 60 * 60 * 24,
       refetchOnWindowFocus: false,
       refetchOnMount: false, // Don't refetch when component mounts
       refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 min in background
       retry: 2,
       retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
       networkMode: 'offlineFirst' as const,
     })),
   });
   
   // Only return memoizedMarketplaces to stabilize query keys
   // This prevents infinite loops when connectedMarketplaces array changes

  const isLoadingProducts = productQueries.some(q => q.isLoading);
  const isLoadingOrders = orderQueries.some(q => q.isLoading);
  const isLoading = isLoadingProducts || isLoadingOrders;
  const isFetching = productQueries.some(q => q.isFetching) || orderQueries.some(q => q.isFetching);
  const hasError = productQueries.some(q => q.isError) || orderQueries.some(q => q.isError);
  const errors = [
    ...productQueries.filter(q => q.error).map(q => ({ marketplace: q.data?.marketplace || 'unknown', error: q.error })),
    ...orderQueries.filter(q => q.error).map(q => ({ marketplace: q.data?.marketplace || 'unknown', error: q.error })),
  ];

  // Stable data version counter for memo dependencies
  const dataVersion = productQueries.reduce((v, q) => v + (q.dataUpdatedAt || 0), 0)
    + orderQueries.reduce((v, q) => v + (q.dataUpdatedAt || 0), 0);

  // Products by marketplace
  const getProducts = (mp: string): MarketplaceProduct[] => {
    const query = productQueries.find(q => q.data?.marketplace === mp);
    return query?.data?.data || [];
  };

  // Orders by marketplace
  const getOrders = (mp: string): MarketplaceOrder[] => {
    const query = orderQueries.find(q => q.data?.marketplace === mp);
    return query?.data?.data || [];
  };

  // All products combined
  const allProducts = productQueries.flatMap(q => q.data?.data || []);
  const allOrders = orderQueries.flatMap(q => q.data?.data || []);

  // Total counts
  const totalProducts = allProducts.length;
  const totalOrders = allOrders.length;

  // Refresh specific marketplace or all
  const refetchProducts = (mp?: string) => {
    if (mp) {
      queryClient.invalidateQueries({ queryKey: ['marketplace-products', mp] });
    } else {
      connectedMarketplaces.forEach(m =>
        queryClient.invalidateQueries({ queryKey: ['marketplace-products', m] })
      );
    }
  };

  const refetchOrders = (mp?: string) => {
    if (mp) {
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', mp] });
    } else {
      connectedMarketplaces.forEach(m =>
        queryClient.invalidateQueries({ queryKey: ['marketplace-orders', m] })
      );
    }
  };

  const refetchAll = () => {
     refetchProducts();
     refetchOrders();
   };

   return {
     // Data accessors
     getProducts,
     getOrders,
     allProducts,
     allOrders,
     totalProducts,
     totalOrders,

     // Stable version for memo dependencies (changes when data updates)
     dataVersion,
     
     // Memoized marketplace list to prevent infinite loops
     memoizedMarketplaces,

     // Loading states
     isLoading,
     isLoadingProducts,
     isLoadingOrders,
     isFetching,
     hasError,
     errors,

     // Refresh functions
     refetchProducts,
     refetchOrders,
     refetchAll,
   };
 }

export type MarketplaceDataStore = ReturnType<typeof useMarketplaceDataStore>;
