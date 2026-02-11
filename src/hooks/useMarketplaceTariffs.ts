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
 * Cached for 30 min — same lifecycle as product data.
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
        if (mp !== 'yandex') continue; // Only Yandex supports tariff calc

        const products = store.getProducts(mp);
        if (products.length === 0) continue;

        // Build unique category+price combos to minimize API calls
        const uniqueOffers: Array<{ categoryId: number; price: number; offerId: string }> = [];
        const seen = new Set<string>();

        for (const p of products) {
          // Use category from product data
          const catKey = `${p.category || 'unknown'}-${p.price || 0}`;
          if (seen.has(catKey)) {
            // Reuse tariff from same category+price
            const existing = uniqueOffers.find(o => `${o.categoryId}-${o.price}` === catKey);
            if (existing) {
              // Will map later
            }
            continue;
          }
          seen.add(catKey);
          uniqueOffers.push({
            categoryId: 0, // Will be determined by Yandex from price/dimensions
            price: p.price || 0,
            offerId: p.offerId,
          });
        }

        // Send batch (max 200)
        const batch = uniqueOffers.slice(0, 200);
        if (batch.length === 0) continue;

        try {
          const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
            body: {
              marketplace: mp,
              dataType: 'tariffs',
              offers: batch.map(o => ({
                categoryId: o.categoryId || 91491, // default electronics category
                price: o.price,
              })),
            },
          });

          if (error || !data?.success) {
            console.warn('Tariff fetch failed:', error || data?.error);
            continue;
          }

          const tariffResults = data.data || [];

          // Map tariff results back to products
          tariffResults.forEach((t: any, idx: number) => {
            if (idx >= batch.length) return;
            const offerId = batch[idx].offerId;
            tariffMap.set(offerId, {
              offerId,
              agencyCommission: t.agencyCommission || 0,
              fulfillment: t.fulfillment || 0,
              delivery: t.delivery || 0,
              totalTariff: t.totalTariff || 0,
              tariffPercent: t.tariffPercent || 0,
            });
          });

          // Map same tariff to products with same category+price
          for (const p of products) {
            if (tariffMap.has(p.offerId)) continue;
            // Find a product with same price that has tariff data
            const similar = products.find(
              sp => sp.price === p.price && tariffMap.has(sp.offerId)
            );
            if (similar) {
              const t = tariffMap.get(similar.offerId)!;
              tariffMap.set(p.offerId, { ...t, offerId: p.offerId });
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
