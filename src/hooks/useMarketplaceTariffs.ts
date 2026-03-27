import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MarketplaceDataStore, MarketplaceProduct } from './useMarketplaceDataStore';
import { getRubToUzs } from '@/lib/currency';

export interface TariffInfo {
  offerId: string;
  agencyCommission: number;
  fulfillment: number;
  delivery: number;
  totalTariff: number;
  tariffPercent: number; // TOTAL tariff as % of price (commission + logistics + all fees)
  commissionPercent: number; // ONLY marketplace commission as % of price (without logistics)
  otherFees?: number; // Extra fixed marketplace fees not covered by logistics buckets
}

// No hardcoded Uzum tariff tiers — only real API data is used

function getYandexTariffBatchKey(input: {
  categoryId: number;
  price: number;
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
}): string {
  return [
    input.categoryId || 0,
    input.price || 0,
    input.length || 0,
    input.width || 0,
    input.height || 0,
    input.weight || 0,
  ].join(':');
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
    queryKey: ['marketplace-tariffs', 'v12-uzum-offerId-fix', connectedMarketplaces.join(','), stableKey],
    queryFn: async () => {
      const tariffMap = new Map<string, TariffInfo>();

      for (const mp of connectedMarketplaces) {
        const products = store.getProducts(mp);
        if (products.length === 0) continue;

        if (mp === 'uzum') {
          // Try to fetch real finance data from Uzum API
          // IMPORTANT: Finance API returns per-transaction entries which we accumulate.
          // We must also track units to compute per-unit rates.
          let realExpenses: Map<string, { commission: number; logistics: number; units: number }> | null = null;
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
                const existing = realExpenses!.get(offerId) || { commission: 0, logistics: 0, units: 0 };
                const amount = Math.abs(exp.amount || exp.value || 0);
                const type = (exp.type || exp.expenseType || '').toLowerCase();
                if (type.includes('commission') || type.includes('komissiya')) {
                  existing.commission += amount;
                  // Each commission entry = 1 unit sold
                  existing.units += 1;
                } else if (type.includes('logist') || type.includes('deliver')) {
                  existing.logistics += amount;
                } else {
                  existing.commission += amount;
                  existing.units += 1;
                }
                realExpenses!.set(offerId, existing);
              });
            }
          } catch (e) {
            console.warn('Uzum finance fetch failed:', e);
          }

          // Apply tariffs per product — ONLY real data from API
          for (const p of products) {
            const price = p.price || 0;
            if (price <= 0) continue;
            
            const realExp = realExpenses?.get(p.offerId);
            if (realExp && (realExp.commission > 0 || realExp.logistics > 0)) {
              // Finance data is ACCUMULATED totals — convert to per-unit
              const units = Math.max(realExp.units, 1);
              const perUnitCommission = realExp.commission / units;
              const perUnitLogistics = realExp.logistics / units;
              const totalTariffPerUnit = perUnitCommission + perUnitLogistics;
              const entry: TariffInfo = {
                offerId: p.offerId,
                agencyCommission: perUnitCommission,
                fulfillment: perUnitLogistics,
                delivery: 0,
                totalTariff: totalTariffPerUnit,
                tariffPercent: price > 0 ? (totalTariffPerUnit / price) * 100 : 0,
                commissionPercent: price > 0 ? (perUnitCommission / price) * 100 : 0,
              };
              tariffMap.set(p.offerId, entry);
              if (p.name) tariffMap.set(p.name.toLowerCase(), entry);
            } else if (p.commissionPercent && p.commissionPercent > 0) {
              // Use REAL commission from product catalog (commissionDto)
              const commissionPercent = p.commissionPercent / 100;
              const commission = price * commissionPercent;
              const entry: TariffInfo = {
                offerId: p.offerId,
                agencyCommission: commission,
                fulfillment: 0,
                delivery: 0,
                totalTariff: commission,
                tariffPercent: price > 0 ? (commission / price) * 100 : 0,
                commissionPercent: p.commissionPercent,
              };
              tariffMap.set(p.offerId, entry);
              if (p.name) tariffMap.set(p.name.toLowerCase(), entry);
            }
            // If no real data — don't add to tariffMap (no estimates)
          }
          continue;
        }

      if (mp === 'wildberries') {
          // WB: Fetch real commission rates from API + logistics coefficients when available
          const rubToUzs = getRubToUzs();
          let commissionBySubject = new Map<string, number>(); // subjectName → commission %
          let wbLogisticsBaseRub = 0;
          let wbLogisticsLiterRub = 0;
          
          try {
            const { data: tariffData, error: tariffError } = await supabase.functions.invoke('fetch-marketplace-data', {
              body: { marketplace: 'wildberries', dataType: 'tariffs' },
            });

            const payload = tariffData?.data;
            const commissionRows = Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.commissions)
                ? payload.commissions
                : [];

            if (!tariffError && tariffData?.success) {
              commissionRows.forEach((t: any) => {
                const subject = (t.subjectName || t.parentName || '').toLowerCase();
                // WB API may return kgvpMarketplace or kgvpMarketplaceUz depending on region
                const commission = t.kgvpMarketplace || t.kgvpMarketplaceUz || t.kgvpSupplier || t.kgvpSupplierUz || t.paidStorageKgvp || t.paidStorageKgvpUz || t.commission || 0;
                if (subject && commission > 0) {
                  commissionBySubject.set(subject, commission / 100); // convert % to decimal
                }
              });

              if (!Array.isArray(payload) && payload?.logistics) {
                wbLogisticsBaseRub = Number(payload.logistics.deliveryBase || 0);
                wbLogisticsLiterRub = Number(payload.logistics.deliveryLiter || 0);
              }

              // WB tariffs loaded
            }
          } catch (e) {
            console.warn('WB tariff fetch failed, using estimates:', e);
          }

          for (const p of products) {
            const priceRub = p.price || 0;
            if (priceRub <= 0) continue;
            
            // Find real commission for this product
            // Priority: 1) per-product commissionPercent from API, 2) category match from tariffs, 3) fallback 15%
            const productCategory = (p.category || '').toLowerCase();
            let commissionPercent = 0.15; // fallback 15%
            
            // Use real commission from product if available (enriched server-side)
            if (p.commissionPercent && p.commissionPercent > 0) {
              commissionPercent = p.commissionPercent / 100; // API returns as whole number (e.g. 15 = 15%)
            } else if (commissionBySubject.has(productCategory)) {
              commissionPercent = commissionBySubject.get(productCategory)!;
            } else {
              // Try partial match
              for (const [subject, rate] of commissionBySubject) {
                if (productCategory.includes(subject) || subject.includes(productCategory)) {
                  commissionPercent = rate;
                  break;
                }
              }
            }

            // Use real dimensions if available, else estimate by price
            const volumeLiters = (p.lengthCm && p.widthCm && p.heightCm)
              ? (p.lengthCm * p.widthCm * p.heightCm) / 1000
              : (priceRub > 7000 ? 8 : priceRub > 3000 ? 3 : 1.2);
            const logisticsFromApiRub = wbLogisticsBaseRub > 0
              ? wbLogisticsBaseRub + (wbLogisticsLiterRub * volumeLiters)
              : 0;
            const logisticsRub = logisticsFromApiRub > 0
              ? logisticsFromApiRub
              : (priceRub > 5000 ? 100 : priceRub > 1000 ? 50 : 30);
            const commissionRub = priceRub * commissionPercent;
            const totalTariffRub = commissionRub + logisticsRub;
            
            // Store in UZS for uniform downstream consumers
            tariffMap.set(p.offerId, {
              offerId: p.offerId,
              agencyCommission: Math.round(commissionRub * rubToUzs),
              fulfillment: Math.round(logisticsRub * rubToUzs),
              delivery: 0,
              totalTariff: Math.round(totalTariffRub * rubToUzs),
              tariffPercent: priceRub > 0 ? (totalTariffRub / priceRub) * 100 : 0,
              commissionPercent: commissionPercent * 100,
            });
          }
          continue;
        }

        if (mp !== 'yandex') continue;

        // Yandex: fetch real tariffs from API
        const batch: Array<{ categoryId: number; price: number; offerId: string; length?: number; width?: number; height?: number; weight?: number }> = [];
        const seen = new Set<string>();

        for (const p of products) {
          const categoryId = p.marketCategoryId || 0;
          const price = p.price || 0;
          const batchKey = getYandexTariffBatchKey({
            categoryId,
            price,
            length: p.lengthCm,
            width: p.widthCm,
            height: p.heightCm,
            weight: p.weightKg,
          });

          if (seen.has(batchKey)) continue;
          seen.add(batchKey);

          if (categoryId > 0 && price > 0) {
            batch.push({
              categoryId,
              price,
              offerId: p.offerId,
              length: p.lengthCm,
              width: p.widthCm,
              height: p.heightCm,
              weight: p.weightKg,
            });
          }
        }

        if (batch.length === 0) continue;

        try {
          for (let start = 0; start < batch.length; start += 200) {
            const sendBatch = batch.slice(start, start + 200);

            const { data, error } = await supabase.functions.invoke('fetch-marketplace-data', {
              body: {
                marketplace: mp,
                dataType: 'tariffs',
                offers: sendBatch.map(o => ({
                  categoryId: o.categoryId,
                  price: o.price,
                  length: o.length,
                  width: o.width,
                  height: o.height,
                  weight: o.weight,
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
              const apiCommissionPercent = t.commissionPercent || (offerPrice > 0 ? (commission / offerPrice) * 100 : 0);

              tariffMap.set(offerId, {
                offerId,
                agencyCommission: commission,
                fulfillment: t.fulfillment || 0,
                delivery: (t.delivery || 0) + (t.sorting || 0),
                otherFees: t.other || 0,
                totalTariff: t.totalTariff || 0,
                tariffPercent: t.tariffPercent || 0,
                commissionPercent: apiCommissionPercent,
              });
            });
          }

          // Map same tariff only to products with the SAME category, price and dimensions
          for (const p of products) {
            if (tariffMap.has(p.offerId)) continue;
            const categoryId = p.marketCategoryId || 0;
            const price = p.price || 0;

            if (categoryId > 0 && price > 0) {
              const productKey = getYandexTariffBatchKey({
                categoryId,
                price,
                length: p.lengthCm,
                width: p.widthCm,
                height: p.heightCm,
                weight: p.weightKg,
              });

              const similar = products.find(sp => {
                if (!tariffMap.has(sp.offerId)) return false;
                return getYandexTariffBatchKey({
                  categoryId: sp.marketCategoryId || 0,
                  price: sp.price || 0,
                  length: sp.lengthCm,
                  width: sp.widthCm,
                  height: sp.heightCm,
                  weight: sp.weightKg,
                }) === productKey;
              });

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
 * 
 * Yandex: FEE (~15.5%) + PAYMENT_TRANSFER (~1.5%) + DELIVERY (~6000) + withdrawal (~1%)
 * Uzum: Commission (10-20%) + Service fee (2%) + Logistics (4000-20000)
 * WB: Commission (5-25%) + Logistics (base + per-liter)
 */
export function getTariffForProduct(
  tariffMap: Map<string, TariffInfo> | undefined,
  offerId: string,
  price: number,
  marketplace?: string,
  /** Yandex: price before subsidy — commission is charged on this, not buyer price */
  commissionBase?: number,
): { commission: number; logistics: number; withdrawal: number; totalFee: number; isReal: boolean } {
  const tariff = safeMapGet(tariffMap, offerId);
  // For Yandex: commission is on pre-subsidy price, not buyer price
  const commBase = commissionBase && commissionBase > price ? commissionBase : price;
  
  if (tariff && tariff.totalTariff > 0) {
    const extraFees = tariff.otherFees || 0;
    let commission = tariff.agencyCommission;
    let totalTariff = tariff.totalTariff;

    if (marketplace === 'yandex' && commissionBase && commissionBase > 0 && tariff.commissionPercent > 0) {
      // Recalculate commission using the REAL base (pre-subsidy price)
      commission = Math.round(commBase * (tariff.commissionPercent / 100));
      totalTariff = commission + tariff.fulfillment + tariff.delivery + extraFees;
    }

    const withdrawalFee = marketplace === 'yandex' ? Math.round(price * 0.01) : 0;
    return {
      commission,
      logistics: tariff.fulfillment + tariff.delivery + extraFees,
      withdrawal: withdrawalFee,
      totalFee: totalTariff + withdrawalFee,
      isReal: true,
    };
  }

  // No estimates — only real API data or zero
  return {
    commission: 0,
    logistics: 0,
    withdrawal: 0,
    totalFee: 0,
    isReal: false,
  };
}
