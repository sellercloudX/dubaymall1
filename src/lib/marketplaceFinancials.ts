import { toDisplayUzs } from "@/lib/currency";
import { getOrderRevenueUzs } from "@/lib/revenueCalculations";
import { getTariffForProduct, type TariffInfo } from "@/hooks/useMarketplaceTariffs";
import { getMinLogisticsUzs, normalizeLogistics } from "@/lib/marketplaceCalculator";
import type { MarketplaceOrder } from "@/hooks/useMarketplaceDataStore";
import { normalizeMarketplaceFinance } from "@/lib/marketplaceDataNormalizer";

const UZB_TAX_RATE = 0.04;

export interface OrderItemFinancialLine {
  offerId: string;
  offerName: string;
  photo?: string;
  quantity: number;
  revenue: number;
  costTotal: number;
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  tax: number;
  hasCostPrice: boolean;
  hasRealTariff: boolean;
  fulfillmentType?: "FBO" | "FBS";
}

export interface OrderFinancialBreakdown {
  revenue: number;
  costTotal: number;
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  taxAmount: number;
  grossProfit: number;
  netProfit: number;
  margin: number;
  itemCount: number;
  costCoveredItems: number;
  realTariffItems: number;
  lines: OrderItemFinancialLine[];
}

/**
 * Exact fees extraction - debug bilan kuchaytirilgan
 */
function extractExactFees(item: any, marketplace: string) {
  const normalized = normalizeMarketplaceFinance(item, marketplace);

  const hasAnyRealData =
    normalized.actualCommission > 0 || normalized.actualLogisticsFee > 0 || normalized.actualSoldPrice > 0;

  // CRITICAL: normalizeMarketplaceFinance returns values in the marketplace's native currency
  // (RUB for WB, UZS for Uzum/Yandex). We MUST convert to UZS for uniform downstream use.
  const c = (v: number) => toDisplayUzs(v, marketplace);

  const rawLogisticsUzs = c(normalized.actualLogisticsFee);
  const enforcedLogisticsUzs = hasAnyRealData
    ? normalizeLogistics(rawLogisticsUzs, marketplace)
    : 0;

  const commissionUzs = c(normalized.actualCommission);
  const otherFeesUzs = c(normalized.actualOtherFees);

  return {
    commission: commissionUzs,
    logistics: enforcedLogisticsUzs,
    withdrawal: otherFeesUzs,
    totalFees: commissionUzs + enforcedLogisticsUzs + otherFeesUzs,
    actualSoldPrice: c(normalized.actualSoldPrice || 0),
    grossPrice: c(normalized.grossPrice || 0),
    subsidyAmount: c(normalized.subsidyAmount || 0),
    isReal: hasAnyRealData,
    financeSource: normalized.financeSource || "unknown",
  };
}

export function calculateOrderFinancialBreakdown(
  order: MarketplaceOrder,
  marketplace: string,
  getCostPrice: (marketplace: string, offerId: string) => number | null,
  tariffMap: Map<string, TariffInfo> | undefined,
): OrderFinancialBreakdown {
  const lines: OrderItemFinancialLine[] = [];
  const items = order.items || [];

  let revenue = 0;
  let costTotal = 0;
  let commission = 0;
  let logistics = 0;
  let withdrawal = 0;
  let totalFees = 0;
  let itemCount = 0;
  let costCoveredItems = 0;
  let realTariffItems = 0;

  // Helper: round monetary values for UZS marketplaces (Yandex, Uzum)
  const isUzs = marketplace === 'yandex' || marketplace === 'uzum';
  const r = (v: number) => isUzs ? Math.round(v) : v;

  for (const item of items) {
    const quantity = item.count || 1;
    const rawCostPrice = getCostPrice(marketplace, item.offerId);
    const costPriceUzs = rawCostPrice !== null ? toDisplayUzs(rawCostPrice, marketplace) : 0;
    const itemCostTotal = costPriceUzs * quantity;

    const fees = extractExactFees(item, marketplace);

    // Revenue: prefer actualSoldPrice from finance enrichment, then gross price, then item price
    const basePrice = toDisplayUzs(item.price || 0, marketplace);
    const itemRevenue = fees.actualSoldPrice > 0
      ? fees.actualSoldPrice
      : (fees.grossPrice > 0 ? fees.grossPrice : basePrice);

    // Fees: prefer exact fees from finance reports; fallback to tariffMap estimates
    let itemCommission = r(fees.commission);
    let itemLogistics = r(fees.logistics);
    let itemWithdrawal = r(fees.withdrawal);
    let itemTotalFees = r(fees.totalFees);
    let hasRealFees = fees.isReal;

    // CRITICAL: If no exact fees from finance enrichment, use tariffMap as fallback
    if (!hasRealFees && tariffMap && item.offerId) {
      const tariffFallback = getTariffForProduct(tariffMap, item.offerId, basePrice, marketplace);
      if (tariffFallback.isReal && tariffFallback.totalFee > 0) {
        // Tariff is per-unit, multiply by quantity
        itemCommission = r(tariffFallback.commission * quantity);
        itemLogistics = r(tariffFallback.logistics * quantity);
        itemWithdrawal = r(tariffFallback.withdrawal * quantity);
        itemTotalFees = r(tariffFallback.totalFee * quantity);
        hasRealFees = true;
      }
    }

    const itemTax = r(itemRevenue * UZB_TAX_RATE);

    revenue += itemRevenue;
    costTotal += itemCostTotal;
    commission += itemCommission;
    logistics += itemLogistics;
    withdrawal += itemWithdrawal;
    totalFees += itemTotalFees;
    itemCount += quantity;

    if (rawCostPrice !== null) costCoveredItems += quantity;
    if (hasRealFees) realTariffItems += quantity;

    lines.push({
      offerId: item.offerId,
      offerName: item.offerName || item.offerId,
      photo: item.photo,
      quantity,
      revenue: itemRevenue,
      costTotal: itemCostTotal,
      commission: itemCommission,
      logistics: itemLogistics,
      withdrawal: itemWithdrawal,
      totalFees: itemTotalFees,
      tax: itemTax,
      hasCostPrice: rawCostPrice !== null,
      hasRealTariff: hasRealFees,
      fulfillmentType: order.fulfillmentType,
    });
  }

  const taxAmount = r(revenue * UZB_TAX_RATE);
  const grossProfit = revenue - costTotal;
  const netProfit = grossProfit - totalFees - taxAmount;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    costTotal,
    commission,
    logistics,
    withdrawal,
    totalFees,
    taxAmount,
    grossProfit,
    netProfit,
    margin,
    itemCount,
    costCoveredItems,
    realTariffItems,
    lines,
  };
}
