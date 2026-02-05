 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 
 export function useShippingCalculation() {
   const { data: regions } = useQuery({
     queryKey: ['regions'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('regions')
         .select('*')
         .eq('is_active', true)
         .order('name_uz');
 
       if (error) throw error;
       return data || [];
     },
   });
 
   const { data: shippingRates } = useQuery({
     queryKey: ['shipping-rates'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('regional_shipping_rates')
         .select('*')
         .eq('is_active', true);
 
       if (error) throw error;
       return data || [];
     },
   });
 
   // Calculate shipping cost for a product to a specific region
   const calculateShipping = (
     regionId: string,
     productWeight: number = 0,
     sellerShippingPrice: number = 0,
     isFreeShipping: boolean = false
   ): { baseRate: number; weightRate: number; sellerRate: number; total: number } => {
     if (isFreeShipping) {
       return { baseRate: 0, weightRate: 0, sellerRate: 0, total: 0 };
     }
 
     const regionRate = shippingRates?.find((r) => r.region_id === regionId);
     const baseRate = regionRate?.base_rate || 0;
     const perKgRate = regionRate?.per_kg_rate || 0;
     const weightRate = productWeight * perKgRate;
 
     return {
       baseRate: Number(baseRate),
       weightRate,
       sellerRate: sellerShippingPrice,
       total: Number(baseRate) + weightRate + sellerShippingPrice,
     };
   };
 
   // Get shipping options for checkout
   const getShippingOptions = (
     productWeight: number = 0,
     sellerShippingPrice: number = 0,
     isFreeShipping: boolean = false
   ) => {
     if (!regions) return [];
 
     return regions.map((region) => {
       const shipping = calculateShipping(
         region.id,
         productWeight,
         sellerShippingPrice,
         isFreeShipping
       );
 
       return {
         regionId: region.id,
         regionName: region.name_uz,
         regionCode: region.code,
         ...shipping,
       };
     });
   };
 
   return {
     regions,
     shippingRates,
     calculateShipping,
     getShippingOptions,
   };
 }