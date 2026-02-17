import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MarketplaceDataStore, MarketplaceProduct } from './useMarketplaceDataStore';

export interface TariffInfo {
  offerId: string;
  agencyCommission: number;
  fulfillment: number;
  delivery: number;
  totalTariff: number;
  tariffPercent: number; // TOTAL tariff as % of price (commission + logistics + all fees)
  commissionPercent: number; // ONLY marketplace commission as % of price (without logistics)
}

// Uzum tariff rates — based on official Uzum Market docs
// Commission varies by category (up to 35%), using category-aware defaults
// Logistics: 20,000 (large), 8,000 (medium), 2,000-6,000 (small) UZS
const UZUM_COMMISSION_BY_PRICE: Array<{ maxPrice: number; percent: number }> = [
  { maxPrice: 50000, percent: 0.20 },    // cheap items → higher %
  { maxPrice: 200000, percent: 0.15 },   // medium
  { maxPrice: 1000000, percent: 0.12 },  // standard
  { maxPrice: Infinity, percent: 0.10 }, // expensive items → lower %
];
const UZUM_SERVICE_FEE_PERCENT = 0.02; // 2% xizmat haqi

function getUzumCommissionPercent(price: number): number {
  for (const tier of UZUM_COMMISSION_BY_PRICE) {
    if (price <= tier.maxPrice) return tier.percent;
  }
  return 0.12;
}

function getUzumLogistics(price: number): number {
  // Approximate by price: expensive = likely larger
  if (price > 500000) return 20000;
  if (price > 100000) return 8000;
  return 4000;
}

/**
 * Fetches real Yandex Market tariffs for connected products.
 * For Uzum — uses known fee structure (commission varies by price tier + logistics + service fee).
 * Also fetches Uzum finance API for real expense data when available.
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
          // Try to fetch real finance data from Uzum API
          let realExpenses: Map<string, { commission: number; logistics: number }> | null = null;
          try {
            const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
              body: { marketplace: 'uzum', dataType: 'finance' },
            });
            if (!error && data?.success && data?.data?.expenses) {
              realExpenses = new Map();
              const expenses = Array.isArray(data.data.expenses) ? data.data.expenses : [];
              expenses.forEach((exp: any) => {
                const offerId = String(exp.productId || exp.skuId || '');
                if (!offerId) return;
                const existing = realExpenses!.get(offerId) || { commission: 0, logistics: 0 };
                const amount = Math.abs(exp.amount || exp.value || 0);
                const type = (exp.type || exp.expenseType || '').toLowerCase();
                if (type.includes('commission') || type.includes('komissiya')) {
                  existing.commission += amount;
                } else if (type.includes('logist') || type.includes('deliver')) {
                  existing.logistics += amount;
                } else {
                  existing.commission += amount; // default to commission
                }
                realExpenses!.set(offerId, existing);
              });
              console.log(`Uzum finance: got real expenses for ${realExpenses.size} products`);
            }
          } catch (e) {
            console.warn('Uzum finance fetch failed, using estimated tariffs:', e);
          }

          // Apply tariffs per product
          for (const p of products) {
            const price = p.price || 0;
            if (price <= 0) continue;
            
            const realExp = realExpenses?.get(p.offerId);
            if (realExp && (realExp.commission > 0 || realExp.logistics > 0)) {
              // Use real finance data
              const totalTariff = realExp.commission + realExp.logistics;
              tariffMap.set(p.offerId, {
                offerId: p.offerId,
                agencyCommission: realExp.commission,
                fulfillment: realExp.logistics,
                delivery: 0,
                totalTariff,
                tariffPercent: price > 0 ? (totalTariff / price) * 100 : 0,
                commissionPercent: price > 0 ? (realExp.commission / price) * 100 : 0,
              });
            } else {
              // Use estimated tariffs based on price tier
              const commissionPercent = getUzumCommissionPercent(price);
              const commission = price * commissionPercent;
              const serviceFee = price * UZUM_SERVICE_FEE_PERCENT;
              const logistics = getUzumLogistics(price);
              const totalTariff = commission + serviceFee + logistics;
              tariffMap.set(p.offerId, {
                offerId: p.offerId,
                agencyCommission: commission + serviceFee,
                fulfillment: logistics,
                delivery: 0,
                totalTariff,
                tariffPercent: price > 0 ? (totalTariff / price) * 100 : 0,
                commissionPercent: price > 0 ? ((commission + serviceFee) / price) * 100 : 0,
              });
            }
          }
          continue;
        }

        if (mp === 'wildberries') {
          // WB: commission ~15-20% depending on category, logistics ~50-100 RUB
          for (const p of products) {
            const price = p.price || 0;
            if (price <= 0) continue;
            // WB typical: 15% commission + logistics
            const commission = price * 0.15;
            const logistics = price > 500000 ? 15000 : price > 100000 ? 8000 : 5000;
            const totalTariff = commission + logistics;
            tariffMap.set(p.offerId, {
              offerId: p.offerId,
              agencyCommission: commission,
              fulfillment: logistics,
              delivery: 0,
              totalTariff,
              tariffPercent: price > 0 ? (totalTariff / price) * 100 : 0,
              commissionPercent: price > 0 ? (commission / price) * 100 : 0,
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
            const commission = t.agencyCommission || 0;
            const offerPrice = sendBatch[idx]?.price || 0;
            // Use API-extracted commissionPercent directly (most accurate)
            const apiCommissionPercent = t.commissionPercent || (offerPrice > 0 ? (commission / offerPrice) * 100 : 0);
            tariffMap.set(offerId, {
              offerId,
              agencyCommission: commission,
              fulfillment: t.fulfillment || 0,
              delivery: (t.delivery || 0) + (t.sorting || 0),
              totalTariff: t.totalTariff || 0,
              tariffPercent: t.tariffPercent || 0,
              commissionPercent: apiCommissionPercent,
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
    const commissionPercent = getUzumCommissionPercent(price);
    const commission = price * commissionPercent;
    const serviceFee = price * UZUM_SERVICE_FEE_PERCENT;
    const logistics = getUzumLogistics(price);
    return {
      commission: commission + serviceFee,
      logistics,
      totalFee: commission + serviceFee + logistics,
      isReal: false,
    };
  }

  // WB fallback
  if (marketplace === 'wildberries') {
    const commission = price * 0.15;
    const logistics = price > 500000 ? 15000 : price > 100000 ? 8000 : 5000;
    return {
      commission,
      logistics,
      totalFee: commission + logistics,
      isReal: false,
    };
  }

  if (safeMapSize(tariffMap) > 0) {
    const values = safeMapValues(tariffMap);
    // Use average COMMISSION percent (not total tariff) for estimation
    const avgCommissionPercent = values.reduce((s, t) => s + t.commissionPercent, 0) / values.length;
    const avgLogistics = values.reduce((s, t) => s + t.fulfillment + t.delivery, 0) / values.length;
    const estCommission = price * (avgCommissionPercent / 100);
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
