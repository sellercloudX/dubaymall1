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

// Uzum default tariff rates by approximate category
const UZUM_DEFAULT_COMMISSION_PERCENT = 0.12; // 12% o'rtacha
const UZUM_DEFAULT_LOGISTICS = 5000; // ~5000 so'm logistika
const UZUM_SERVICE_FEE_PERCENT = 0.02; // 2% xizmat haqi

/**
 * Fetches real Yandex Market tariffs for connected products.
 * For Uzum — uses known fee structure (commission + logistics + service fee).
 * Uses POST /v2/tariffs/calculate API via edge function for Yandex.
 */
export function useMarketplaceTariffs(
  connectedMarketplaces: string[],
  store: MarketplaceDataStore
) {
  const productIds = connectedMarketplaces
    .flatMap(mp => store.getProducts(mp).map(p => p.offerId))
    .sort()
    .join(',');
  const stableKey = productIds.length > 0 ? productIds.substring(0, 200) : 'empty';

  return useQuery({
    queryKey: ['marketplace-tariffs', connectedMarketplaces.join(','), stableKey],
    queryFn: async () => {
      const tariffMap = new Map<string, TariffInfo>();

      for (const mp of connectedMarketplaces) {
        const products = store.getProducts(mp);
        if (products.length === 0) continue;

        if (mp === 'uzum') {
          // Uzum: use known fee structure
          for (const p of products) {
            const price = p.price || 0;
            if (price <= 0) continue;
            const commission = price * UZUM_DEFAULT_COMMISSION_PERCENT;
            const serviceFee = price * UZUM_SERVICE_FEE_PERCENT;
            const logistics = UZUM_DEFAULT_LOGISTICS;
            const totalTariff = commission + serviceFee + logistics;
            tariffMap.set(p.offerId, {
              offerId: p.offerId,
              agencyCommission: commission + serviceFee,
              fulfillment: logistics,
              delivery: 0,
              totalTariff,
              tariffPercent: price > 0 ? (totalTariff / price) * 100 : 0,
            });
          }
          continue;
        }

        if (mp !== 'yandex') continue;

        // Yandex: fetch real tariffs from API
        const batch: Array<{ categoryId: number; price: number; offerId: string }> = [];
        const seen = new Set<string>();

        for (const p of products) {
          const catId = p.marketCategoryId || 0;
          const price = p.price || 0;
          const catKey = `${catId}-${price}`;
          
          if (seen.has(catKey)) continue;
          seen.add(catKey);
          
          if (catId > 0 && price > 0) {
            batch.push({ categoryId: catId, price, offerId: p.offerId });
          }
        }

        if (batch.length === 0) continue;

        const sendBatch = batch.slice(0, 200);

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
            console.warn('Tariff fetch failed:', error || data?.error);
            continue;
          }

          const tariffResults = data.data || [];

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

          // Map same tariff to products with SAME category+price
          for (const p of products) {
            if (tariffMap.has(p.offerId)) continue;
            const catId = p.marketCategoryId || 0;
            const price = p.price || 0;
            
            if (catId > 0 && price > 0) {
              const similar = products.find(
                sp => (sp.marketCategoryId || 0) === catId && sp.price === price && tariffMap.has(sp.offerId)
              );
              if (similar) {
                const t = tariffMap.get(similar.offerId)!;
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
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always' as const,
    refetchInterval: 1000 * 60 * 60,
  });
}

/**
 * Safely get from tariffMap — handles both Map and plain object (from cache deserialization)
 */
function safeMapGet(map: any, key: string): TariffInfo | undefined {
  if (!map) return undefined;
  if (map instanceof Map) return map.get(key);
  if (typeof map === 'object' && key in map) return map[key];
  return undefined;
}

function safeMapSize(map: any): number {
  if (!map) return 0;
  if (map instanceof Map) return map.size;
  if (typeof map === 'object') return Object.keys(map).length;
  return 0;
}

function safeMapValues(map: any): TariffInfo[] {
  if (!map) return [];
  if (map instanceof Map) return Array.from(map.values());
  if (typeof map === 'object') return Object.values(map);
  return [];
}

/**
 * Get tariff for a specific product.
 * Marketplace-aware: uses real data when available, sensible fallbacks otherwise.
 */
export function getTariffForProduct(
  tariffMap: Map<string, TariffInfo> | undefined,
  offerId: string,
  price: number,
  marketplace?: string
): { commission: number; logistics: number; totalFee: number; isReal: boolean } {
  const tariff = safeMapGet(tariffMap, offerId);
  if (tariff && tariff.totalTariff > 0) {
    return {
      commission: tariff.agencyCommission,
      logistics: tariff.fulfillment + tariff.delivery,
      totalFee: tariff.totalTariff,
      isReal: true,
    };
  }

  // Marketplace-specific fallbacks
  if (marketplace === 'uzum') {
    const commission = price * UZUM_DEFAULT_COMMISSION_PERCENT;
    const serviceFee = price * UZUM_SERVICE_FEE_PERCENT;
    const logistics = UZUM_DEFAULT_LOGISTICS;
    return {
      commission: commission + serviceFee,
      logistics,
      totalFee: commission + serviceFee + logistics,
      isReal: false,
    };
  }

  // Yandex: use average from real data
  if (safeMapSize(tariffMap) > 0) {
    const values = safeMapValues(tariffMap);
    const avgPercent = values.reduce((s, t) => s + t.tariffPercent, 0) / values.length;
    const avgLogistics = values.reduce((s, t) => s + t.fulfillment + t.delivery, 0) / values.length;
    const estCommission = price * (avgPercent / 100) * 0.6;
    return {
      commission: estCommission,
      logistics: avgLogistics,
      totalFee: estCommission + avgLogistics,
      isReal: false,
    };
  }

  // Last resort fallback
  return {
    commission: price * 0.15,
    logistics: 3000,
    totalFee: price * 0.15 + 3000,
    isReal: false,
  };
}
