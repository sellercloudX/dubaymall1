 import { useQuery, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 
 interface MarketplaceProduct {
   offerId: string;
   name: string;
   price?: number;
   shopSku?: string;
   category?: string;
   pictures?: string[];
   availability?: string;
   stockFBO?: number;
   stockFBS?: number;
   stockCount?: number;
 }
 
 interface MarketplaceOrder {
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
 
 interface MarketplaceStats {
   totalProducts: number;
   totalOrders: number;
   totalRevenue: number;
   pendingOrders: number;
   processingOrders: number;
   deliveredOrders: number;
   cancelledOrders: number;
   lowStockProducts: number;
   outOfStockProducts: number;
   averageOrderValue: number;
   revenueByDay: { date: string; revenue: number; orders: number }[];
   topProducts: { offerId: string; name: string; quantity: number; revenue: number }[];
 }
 
 // Fetch marketplace data with edge function
 async function fetchMarketplaceData(
   marketplace: string,
   dataType: string,
   options: Record<string, any> = {}
 ) {
   const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
     body: { marketplace, dataType, ...options },
   });
 
   if (error) throw error;
   return data;
 }
 
 // Products hook with TanStack Query caching
 export function useMarketplaceProducts(marketplace: string | null) {
   return useQuery({
     queryKey: ['marketplace-products', marketplace],
     queryFn: async () => {
       if (!marketplace) return { data: [], total: 0 };
       const result = await fetchMarketplaceData(marketplace, 'products', { 
         limit: 200, 
         fetchAll: true 
       });
       return {
         data: (result.data || []) as MarketplaceProduct[],
         total: result.total || result.data?.length || 0,
       };
     },
     enabled: !!marketplace,
     staleTime: 1000 * 60 * 5, // 5 minutes - data is fresh
     gcTime: 1000 * 60 * 60 * 24, // 24 hours in cache for offline
     refetchOnWindowFocus: false,
     retry: 2,
     retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
   });
 }
 
 // Orders hook with TanStack Query caching
 export function useMarketplaceOrders(marketplace: string | null, options?: {
   fromDate?: string;
   toDate?: string;
   status?: string;
 }) {
   return useQuery({
     queryKey: ['marketplace-orders', marketplace, options],
     queryFn: async () => {
       if (!marketplace) return { data: [], total: 0 };
       const result = await fetchMarketplaceData(marketplace, 'orders', { 
         fetchAll: true,
         ...options,
       });
       return {
         data: (result.data || []) as MarketplaceOrder[],
         total: result.total || result.data?.length || 0,
       };
     },
     enabled: !!marketplace,
     staleTime: 1000 * 60 * 2, // 2 minutes for orders - more frequent
     gcTime: 1000 * 60 * 60 * 24, // 24 hours in cache
     refetchOnWindowFocus: false,
     retry: 2,
   });
 }
 
 // Marketplace analytics computed from products and orders
 export function useMarketplaceStats(marketplace: string | null) {
   const { data: productsData, isLoading: productsLoading } = useMarketplaceProducts(marketplace);
   const { data: ordersData, isLoading: ordersLoading } = useMarketplaceOrders(marketplace);
 
   return useQuery({
     queryKey: ['marketplace-stats', marketplace, productsData?.total, ordersData?.total],
     queryFn: (): MarketplaceStats => {
       const products = productsData?.data || [];
       const orders = ordersData?.data || [];
 
       // Calculate stats
       const totalProducts = products.length;
       const totalOrders = orders.length;
       
       // Revenue from completed orders (DELIVERED, PICKUP)
       const completedOrders = orders.filter(o => 
         ['DELIVERED', 'PICKUP', 'DELIVERY'].includes(o.status)
       );
       const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalUZS || o.total || 0), 0);
       
       // Order statuses
       const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
       const processingOrders = orders.filter(o => 
         ['PROCESSING', 'DELIVERY', 'PICKUP'].includes(o.status)
       ).length;
       const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length;
       const cancelledOrders = orders.filter(o => 
         ['CANCELLED', 'RETURNED'].includes(o.status)
       ).length;
 
       // Stock status
       const lowStockProducts = products.filter(p => 
         (p.stockCount || 0) > 0 && (p.stockCount || 0) < 5
       ).length;
       const outOfStockProducts = products.filter(p => 
         (p.stockCount || 0) === 0
       ).length;
 
       // Average order value
       const averageOrderValue = totalOrders > 0 ? totalRevenue / completedOrders.length : 0;
 
       // Revenue by day (last 7 days)
       const revenueByDay = getRevenueByDay(orders);
 
       // Top products by sales
       const topProducts = getTopProducts(orders);
 
       return {
         totalProducts,
         totalOrders,
         totalRevenue,
         pendingOrders,
         processingOrders,
         deliveredOrders,
         cancelledOrders,
         lowStockProducts,
         outOfStockProducts,
         averageOrderValue,
         revenueByDay,
         topProducts,
       };
     },
     enabled: !productsLoading && !ordersLoading && !!marketplace,
     staleTime: 1000 * 60 * 2,
     gcTime: 1000 * 60 * 60 * 24,
   });
 }
 
 // Helper: Calculate revenue by day
 function getRevenueByDay(orders: MarketplaceOrder[]): { date: string; revenue: number; orders: number }[] {
   const last7Days: { date: string; revenue: number; orders: number }[] = [];
   const today = new Date();
 
   for (let i = 6; i >= 0; i--) {
     const date = new Date(today);
     date.setDate(date.getDate() - i);
     const dateStr = date.toISOString().split('T')[0];
     
     const dayOrders = orders.filter(o => {
       if (!o.createdAt) return false;
       const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
       return orderDate === dateStr && !['CANCELLED', 'RETURNED'].includes(o.status);
     });
 
     last7Days.push({
       date: dateStr,
       revenue: dayOrders.reduce((sum, o) => sum + (o.totalUZS || o.total || 0), 0),
       orders: dayOrders.length,
     });
   }
 
   return last7Days;
 }
 
 // Helper: Get top selling products
 function getTopProducts(orders: MarketplaceOrder[]): { offerId: string; name: string; quantity: number; revenue: number }[] {
   const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
 
   orders.forEach(order => {
     if (['CANCELLED', 'RETURNED'].includes(order.status)) return;
     
     order.items?.forEach(item => {
       const existing = productMap.get(item.offerId) || { name: item.offerName, quantity: 0, revenue: 0 };
       existing.quantity += item.count;
       existing.revenue += (item.priceUZS || item.price) * item.count;
       productMap.set(item.offerId, existing);
     });
   });
 
   return Array.from(productMap.entries())
     .map(([offerId, data]) => ({ offerId, ...data }))
     .sort((a, b) => b.revenue - a.revenue)
     .slice(0, 5);
 }
 
 // Hook to invalidate marketplace data (for refresh)
 export function useInvalidateMarketplaceData() {
   const queryClient = useQueryClient();
 
   return {
     invalidateProducts: (marketplace: string) => 
       queryClient.invalidateQueries({ queryKey: ['marketplace-products', marketplace] }),
     invalidateOrders: (marketplace: string) => 
       queryClient.invalidateQueries({ queryKey: ['marketplace-orders', marketplace] }),
     invalidateStats: (marketplace: string) => 
       queryClient.invalidateQueries({ queryKey: ['marketplace-stats', marketplace] }),
     invalidateAll: (marketplace: string) => {
       queryClient.invalidateQueries({ queryKey: ['marketplace-products', marketplace] });
       queryClient.invalidateQueries({ queryKey: ['marketplace-orders', marketplace] });
       queryClient.invalidateQueries({ queryKey: ['marketplace-stats', marketplace] });
     },
   };
 }