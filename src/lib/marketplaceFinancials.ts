import { toDisplayUzs } from "@/lib/currency";
import { getOrderRevenueUzs } from "@/lib/revenueCalculations";
import { getTariffForProduct, type TariffInfo } from "@/hooks/useMarketplaceTariffs";
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
 * STRICT exact fees extraction — hech qanday taxmin yo'q
 */
function extractExactFees(item: any, marketplace: string) {
  const normalized = normalizeMarketplaceFinance(item, marketplace);

  // Agar normalizer hech narsa topmasa ham, hech bo'lmaganda 0 qiymatlarni qaytarish
  return {
    commission: normalized.actualCommission,
    logistics: normalized.actualLogisticsFee,
    withdrawal: normalized.actualOtherFees,
    totalFees: normalized.actualCommission + normalized.actualLogisticsFee + normalized.actualOtherFees,
    actualSoldPrice: normalized.actualSoldPrice || 0,
    grossPrice: normalized.grossPrice || 0,
    subsidyAmount: normalized.subsidyAmount || 0,
    isReal: normalized.isExact || normalized.actualCommission > 0 || normalized.actualLogisticsFee > 0,
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

  const shouldDebugLog = true; // birinchi marta debugni yoqamiz

  for (const item of items) {
    const quantity = item.count || 1;
    const itemPrice = toDisplayUzs(item.price || 0, marketplace);
    const rawCostPrice = getCostPrice(marketplace, item.offerId);
    const costPriceUzs = rawCostPrice !== null ? toDisplayUzs(rawCostPrice, marketplace) : 0;
    const itemCostTotal = costPriceUzs * quantity;

    // === ASOSIY O'ZGARISH: Hech qachon null qaytarmaslik ===
    const fees = extractExactFees(item, marketplace);

    const itemRevenue = fees.actualSoldPrice > 0 ? fees.actualSoldPrice : toDisplayUzs(item.price || 0, marketplace); // fallback faqat narx

    const itemCommission = fees.commission;
    const itemLogistics = fees.logistics;
    const itemWithdrawal = fees.withdrawal;
    const itemTotalFees = fees.totalFees;

    const hasRealFees = fees.isReal || itemCommission > 0 || itemLogistics > 0;

    if (shouldDebugLog) {
      console.log(`[ORDER_FINANCE_DEBUG] ${marketplace} | item=${item.offerId}`, {
        source: hasRealFees ? "EXACT_API" : "FALLBACK",
        financeSource: fees.financeSource,
        itemRevenue,
        commission: itemCommission,
        logistics: itemLogistics,
        totalFees: itemTotalFees,
        rawFields: {
          actualSoldPrice: item.actualSoldPrice,
          sellerAmount: item.sellerAmount,
          forPay: item.forPay,
          ppvz_for_pay: item.ppvz_for_pay,
          commissionAmount: item.commissionAmount,
          deliveryAmount: item.deliveryAmount,
        },
      });
    }

    const itemTax = itemRevenue * UZB_TAX_RATE;

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

  const taxAmount = revenue * UZB_TAX_RATE;
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
