import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MarketplaceDataStore, MarketplaceProduct } from './useMarketplaceDataStore';

export interface TariffInfo {
  offerId: string;
  agencyCommission: number;
  fulfillment: number;
  delivery: number;
  totalTariff: number;
  tariffPercent: number;
}

/**
 * Fetches real Yandex Market tariffs for connected products.
 * Uses POST /v2/tariffs/calculate API via edge function.
 * Sends real marketCategoryId per product for accurate results.
 */
export function useMarketplaceTariffs(
  connectedMarketplaces: string[],
  store: MarketplaceDataStore
) {
  return useQuery({
    queryKey: ['marketplace-tariffs', connectedMarketplaces.join(','), store.dataVersion],
    queryFn: async () => {
      const tariffMap = new Map<string, TariffInfo>();

      for (const mp of connectedMarketplaces) {
        if (mp !== 'yandex') continue;

        const products = store.getProducts(mp);
        if (products.length === 0) continue;

        // Build unique category+price combos with real categoryIds
        const uniqueOffers: Array<{ categoryId: number; price: number; offerId: string }>[] = [];
        const batch: Array<{ categoryId: number; price: number; offerId: string }> = [];
        const seen = new Set<string>();

        for (const p of products) {
          const catId = p.marketCategoryId || 0;
          const price = p.price || 0;
          const catKey = `${catId}-${price}`;
          
          if (seen.has(catKey)) continue;
          seen.add(catKey);
          
          // Only include products with valid categoryId
          if (catId > 0 && price > 0) {
            batch.push({
              categoryId: catId,
              price,
              offerId: p.offerId,
            });
          }
        }

        if (batch.length === 0) {
          console.log('No products with valid categoryId for tariff calc');
          continue;
        }

        // Send batch (max 200)
        const sendBatch = batch.slice(0, 200);
        console.log(`Sending tariff calc for ${sendBatch.length} unique category+price combos`);

        try {
          const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
            body: {
              marketplace: mp,
              dataType: 'tariffs',
              offers: sendBatch.map(o => ({
                categoryId: o.categoryId,
                price: o.price,
              })),
            },
          });

          if (error || !data?.success) {
            console.warn('Tariff fetch failed:', error || data?.error, data?.details);
            continue;
          }

          const tariffResults = data.data || [];
          console.log(`Got ${tariffResults.length} tariff results`);

          // Map tariff results back to products
          tariffResults.forEach((t: any, idx: number) => {
            if (idx >= sendBatch.length) return;
            const offerId = sendBatch[idx].offerId;
            tariffMap.set(offerId, {
              offerId,
              agencyCommission: t.agencyCommission || 0,
              fulfillment: t.fulfillment || 0,
              delivery: (t.delivery || 0) + (t.sorting || 0),
              totalTariff: t.totalTariff || 0,
              tariffPercent: t.tariffPercent || 0,
            });
          });

          // Map same tariff to products with same category+price
          for (const p of products) {
            if (tariffMap.has(p.offerId)) continue;
            const catId = p.marketCategoryId || 0;
            const price = p.price || 0;
            
            // Find a product with same category+price that has tariff data
            const similar = products.find(
              sp => (sp.marketCategoryId || 0) === catId && sp.price === price && tariffMap.has(sp.offerId)
            );
            if (similar) {
              const t = tariffMap.get(similar.offerId)!;
              tariffMap.set(p.offerId, { ...t, offerId: p.offerId });
            } else if (price > 0) {
              // Try to find any product with same price range (±20%)
              const priceMatch = products.find(
                sp => tariffMap.has(sp.offerId) && 
                      Math.abs((sp.price || 0) - price) / price < 0.2
              );
              if (priceMatch) {
                const t = tariffMap.get(priceMatch.offerId)!;
                tariffMap.set(p.offerId, { ...t, offerId: p.offerId });
              }
            }
          }
        } catch (e) {
          console.error('Tariff fetch error:', e);
        }
      }

      return tariffMap;
    },
    enabled: connectedMarketplaces.length > 0 && !store.isLoadingProducts && store.allProducts.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Get tariff for a specific product.
 * Falls back to estimated 20% + 4000 logistics if no real data.
 */
export function getTariffForProduct(
  tariffMap: Map<string, TariffInfo> | undefined,
  offerId: string,
  price: number
): { commission: number; logistics: number; totalFee: number; isReal: boolean } {
  const tariff = tariffMap?.get(offerId);
  if (tariff && tariff.totalTariff > 0) {
    return {
      commission: tariff.agencyCommission,
      logistics: tariff.fulfillment + tariff.delivery,
      totalFee: tariff.totalTariff,
      isReal: true,
    };
  }
  // Fallback: estimated 20% commission + 4000 logistics
  return {
    commission: price * 0.20,
    logistics: 4000,
    totalFee: price * 0.20 + 4000,
    isReal: false,
  };
}
