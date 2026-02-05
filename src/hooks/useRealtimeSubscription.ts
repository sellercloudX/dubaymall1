 import { useEffect } from 'react';
 import { useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 
 // Real-time subscription for products
 export function useRealtimeProducts(shopId: string | null) {
   const queryClient = useQueryClient();
 
   useEffect(() => {
     if (!shopId) return;
 
     const channel = supabase
       .channel(`products-${shopId}`)
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'products',
           filter: `shop_id=eq.${shopId}`,
         },
         (payload) => {
           console.log('Product change:', payload.eventType);
           
           // Invalidate and refetch
           queryClient.invalidateQueries({ queryKey: ['products', 'shop', shopId] });
           queryClient.invalidateQueries({ queryKey: ['products', 'public'] });
           
           if (payload.eventType === 'INSERT') {
             toast.success('Yangi mahsulot qo\'shildi!', { duration: 3000 });
           } else if (payload.eventType === 'UPDATE') {
             toast.info('Mahsulot yangilandi', { duration: 2000 });
           } else if (payload.eventType === 'DELETE') {
             toast.info('Mahsulot o\'chirildi', { duration: 2000 });
           }
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [shopId, queryClient]);
 }
 
 // Real-time subscription for orders
 export function useRealtimeOrders(productIds: string[]) {
   const queryClient = useQueryClient();
 
   useEffect(() => {
     if (!productIds.length) return;
 
     const channel = supabase
       .channel('seller-orders')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'order_items',
         },
         (payload) => {
           const newRecord = payload.new as any;
           const oldRecord = payload.old as any;
           
           // Check if this order item belongs to our products
           const productId = newRecord?.product_id || oldRecord?.product_id;
           if (productId && productIds.includes(productId)) {
             console.log('Order change for our product:', payload.eventType);
             
             // Invalidate all order-related queries
             queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
             queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
             
             if (payload.eventType === 'INSERT') {
              toast.success('🎉 Yangi buyurtma tushdi!', { duration: 5000 });
             }
           }
         }
       )
       .on(
         'postgres_changes',
         {
           event: 'UPDATE',
           schema: 'public',
           table: 'orders',
         },
         () => {
           queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
           queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [productIds, queryClient]);
 }
 
 // Real-time subscription for seller stats
 export function useRealtimeSellerStats(shopId: string | null) {
   const queryClient = useQueryClient();
 
   useEffect(() => {
     if (!shopId) return;
 
     // Subscribe to order_financials for this shop
     const channel = supabase
       .channel(`seller-financials-${shopId}`)
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'order_financials',
           filter: `shop_id=eq.${shopId}`,
         },
         () => {
           queryClient.invalidateQueries({ queryKey: ['seller-stats', shopId] });
           queryClient.invalidateQueries({ queryKey: ['seller-balance', shopId] });
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [shopId, queryClient]);
 }