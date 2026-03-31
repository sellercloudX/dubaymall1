import { toDisplayUzs } from '@/lib/currency';
import { getOrderRevenueUzs } from '@/lib/revenueCalculations';
import { getTariffForProduct, type TariffInfo } from '@/hooks/useMarketplaceTariffs';
import type { MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';
import { normalizeMarketplaceFinance } from '@/lib/marketplaceDataNormalizer';

// O'zbekiston YATT solig'i — barcha marketplace'lar uchun 4%
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
  fulfillmentType?: 'FBO' | 'FBS';
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

export function getMarketplaceTaxRate(_marketplace: string): number {
  return UZB_TAX_RATE;
}

/**
 * Extract exact fees from any marketplace order item using the unified normalizer.
 * Returns null if no real finance data is present — caller should fall back to tariff estimates.
 *
 * STRICT RULES:
 * - No hardcoded defaults (no 500, 1000, 5000 so'm floors)
 * - No % estimation or tariff/calculate calls
 * - If a field is missing/0 → 0
 * - actual_sold_price = sellerAmount + subsidyAmount
 */
function extractExactFees(item: any, marketplace: string): {
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  actualSoldPrice: number;
  grossPrice: number;
  subsidyAmount: number;
  isReal: boolean;
} | null {
  const normalized = normalizeMarketplaceFinance(item, marketplace);
  if (!normalized.isExact) return null;

  // For WB, the normalizer already converts RUB→UZS via normalizeMarketplaceMoney
  return {
    commission: normalized.actualCommission,
    logistics: normalized.actualLogisticsFee,
    withdrawal: normalized.actualOtherFees,
    totalFees: normalized.actualCommission + normalized.actualLogisticsFee + normalized.actualOtherFees,
    actualSoldPrice: normalized.actualSoldPrice,
    grossPrice: normalized.grossPrice,
    subsidyAmount: normalized.subsidyAmount,
    isReal: true,
  };
}

/**
 * Validate fees — log warnings but DO NOT artificially cap.
 * Real marketplace API data must be passed through as-is.
 */
function validateFees(
  commission: number,
  logistics: number,
  withdrawal: number,
  revenue: number,
  marketplace: string,
  offerId: string,
): { commission: number; logistics: number; withdrawal: number; totalFees: number } {
  const totalFees = commission + logistics + withdrawal;
  
  if (revenue <= 0) {
    return { commission: 0, logistics: 0, withdrawal: 0, totalFees: 0 };
  }
  
  // Log warning if fees seem anomalous, but DO NOT cap — real API data is trusted
  if (totalFees > revenue) {
    console.warn(
      `[FEE_WARN] ${marketplace} offerId=${offerId}: fees=${totalFees} > revenue=${revenue}. ` +
      `commission=${commission}, logistics=${logistics}, withdrawal=${withdrawal}. ` +
      `Passing through real API values without capping.`
    );
  }
  
  return { commission, logistics, withdrawal, totalFees };
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

  if (items.length === 0) {
    revenue = getOrderRevenueUzs(order, marketplace);
  } else {
    for (const item of items) {
      const quantity = item.count || 1;
      const itemPrice = toDisplayUzs(item.price || 0, marketplace);
      let itemRevenue = 0;
      const rawCostPrice = getCostPrice(marketplace, item.offerId);
      const costPriceUzs = rawCostPrice !== null ? toDisplayUzs(rawCostPrice, marketplace) : 0;
      const itemCostTotal = costPriceUzs * quantity;

      // ===== MARKETPLACE-SPECIFIC ACTUAL FEE EXTRACTION =====
      // Single unified path via normalizer — no marketplace-specific branches needed
      let itemCommission = 0;
      let itemLogistics = 0;
      let itemWithdrawal = 0;
      let itemTotalFees = 0;
      let hasRealFees = false;

      const exactFees = extractExactFees(item, marketplace);

      if (exactFees) {
        itemRevenue = exactFees.actualSoldPrice;
        itemCommission = exactFees.commission;
        itemLogistics = exactFees.logistics;
        itemWithdrawal = exactFees.withdrawal;
        itemTotalFees = exactFees.totalFees;
        hasRealFees = true;
      } else {
        // Fallback: tariff map (only used when finance data is unavailable)
        const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice, marketplace);
        itemCommission = tariff.commission;
        itemLogistics = tariff.logistics;
        itemWithdrawal = tariff.withdrawal || 0;
        itemTotalFees = tariff.totalFee;
        itemRevenue = 0;
        hasRealFees = tariff.isReal;
      }

      // ===== VALIDATION: log warnings but pass through real values =====
      const validated = validateFees(
        itemCommission, itemLogistics, itemWithdrawal,
        itemRevenue, marketplace, item.offerId
      );
      itemCommission = validated.commission;
      itemLogistics = validated.logistics;
      itemWithdrawal = validated.withdrawal;
      itemTotalFees = validated.totalFees;

      const itemTax = itemRevenue * getMarketplaceTaxRate(marketplace);

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
  }

  const taxAmount = revenue * getMarketplaceTaxRate(marketplace);
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
