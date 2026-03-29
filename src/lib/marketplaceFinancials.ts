import { toDisplayUzs } from '@/lib/currency';
import { getOrderRevenueUzs } from '@/lib/revenueCalculations';
import { getTariffForProduct, type TariffInfo } from '@/hooks/useMarketplaceTariffs';
import type { MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';

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
 * Extract ACTUAL fees from WB order item using forPay (real seller payout).
 * WB's forPay = what the seller actually receives after ALL deductions
 * (commission + logistics + storage + penalties).
 * totalFees = finishedPrice - forPay
 */
function extractWBActualFees(item: any, marketplace: string): {
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  isReal: boolean;
} | null {
  if (marketplace !== 'wildberries') return null;
  
  const forPay = item.forPay;
  const finishedPrice = item.finishedPrice || item.price || 0;
  
  // forPay must be a positive number and less than the sold price
  if (!forPay || forPay <= 0 || finishedPrice <= 0) return null;
  
  // Total fees = what WB kept = sold price - payout
  const feesPerUnitRub = Math.max(0, finishedPrice - forPay);
  const feesPerUnitUzs = toDisplayUzs(feesPerUnitRub, marketplace);
  
  return {
    commission: feesPerUnitUzs, // WB combines all fees; we report as "commission"
    logistics: 0, // Already included in the combined fee
    withdrawal: 0,
    totalFees: feesPerUnitUzs,
    isReal: true,
  };
}

/**
 * Extract fees from Uzum order item using item-level commissionPercent/commissionBase.
 * Uzum orders carry commission data per item from the finance API.
 */
function extractUzumActualFees(item: any, itemPriceUzs: number, marketplace: string): {
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  isReal: boolean;
} | null {
  if (marketplace !== 'uzum') return null;
  
  // Check if item has actual commission data from the order/finance API
  const itemCommPercent = item.commissionPercent;
  const itemCommBase = item.commissionBase; // absolute commission amount
  
  if (itemCommBase && itemCommBase > 0) {
    // Absolute commission amount from the API
    const commission = itemCommBase;
    return {
      commission,
      logistics: 0,
      withdrawal: 0,
      totalFees: commission,
      isReal: true,
    };
  }
  
  if (itemCommPercent && itemCommPercent > 0 && itemPriceUzs > 0) {
    // Commission percentage from the API applied to actual sold price
    const commission = Math.round(itemPriceUzs * (itemCommPercent / 100));
    return {
      commission,
      logistics: 0,
      withdrawal: 0,
      totalFees: commission,
      isReal: true,
    };
  }
  
  return null;
}

/**
 * Validate and cap fees to prevent impossible calculations.
 * Fees should NEVER exceed the revenue for a given item.
 * Max reasonable fee ratio: 50% for commission, 80% total (incl logistics).
 */
function validateAndCapFees(
  commission: number,
  logistics: number,
  withdrawal: number,
  revenue: number,
  marketplace: string,
  offerId: string,
): { commission: number; logistics: number; withdrawal: number; totalFees: number } {
  let totalFees = commission + logistics + withdrawal;
  
  if (revenue <= 0) {
    return { commission: 0, logistics: 0, withdrawal: 0, totalFees: 0 };
  }
  
  // Hard cap: total fees cannot exceed 80% of revenue
  // (even high-commission categories + logistics rarely exceed 50-60%)
  const MAX_FEE_RATIO = 0.80;
  if (totalFees > revenue * MAX_FEE_RATIO) {
    console.warn(
      `[FEE_CAP] ${marketplace} offerId=${offerId}: fees=${totalFees} > ${MAX_FEE_RATIO * 100}% of revenue=${revenue}. ` +
      `commission=${commission}, logistics=${logistics}, withdrawal=${withdrawal}. Capping.`
    );
    const capRatio = (revenue * MAX_FEE_RATIO) / totalFees;
    commission = Math.round(commission * capRatio);
    logistics = Math.round(logistics * capRatio);
    withdrawal = Math.round(withdrawal * capRatio);
    totalFees = commission + logistics + withdrawal;
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
      const itemRevenue = itemPrice * quantity;
      const rawCostPrice = getCostPrice(marketplace, item.offerId);
      const costPriceUzs = rawCostPrice !== null ? toDisplayUzs(rawCostPrice, marketplace) : 0;
      const itemCostTotal = costPriceUzs * quantity;

      // ===== MARKETPLACE-SPECIFIC ACTUAL FEE EXTRACTION =====
      // Priority: 1) Actual fees from marketplace API → 2) Tariff-based estimation
      let itemCommission = 0;
      let itemLogistics = 0;
      let itemWithdrawal = 0;
      let itemTotalFees = 0;
      let hasRealFees = false;

      // Try WB actual fees (from forPay)
      const wbFees = extractWBActualFees(item, marketplace);
      if (wbFees) {
        itemCommission = wbFees.commission * quantity;
        itemLogistics = wbFees.logistics * quantity;
        itemWithdrawal = wbFees.withdrawal * quantity;
        itemTotalFees = wbFees.totalFees * quantity;
        hasRealFees = true;
      }

      // Try Uzum actual fees (from item-level commission data)
      if (!hasRealFees) {
        const uzumFees = extractUzumActualFees(item, itemPrice, marketplace);
        if (uzumFees) {
          itemCommission = uzumFees.commission * quantity;
          itemLogistics = uzumFees.logistics * quantity;
          itemWithdrawal = uzumFees.withdrawal * quantity;
          itemTotalFees = uzumFees.totalFees * quantity;
          hasRealFees = true;
        }
      }

      // Fallback: tariff-based calculation
      if (!hasRealFees) {
        const commBase = (item as any).commissionBase
          ? toDisplayUzs((item as any).commissionBase, marketplace)
          : undefined;
        const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice, marketplace, commBase);
        itemCommission = tariff.commission * quantity;
        itemLogistics = tariff.logistics * quantity;
        itemWithdrawal = (tariff.withdrawal || 0) * quantity;
        itemTotalFees = tariff.totalFee * quantity;
        hasRealFees = tariff.isReal;
      }

      // ===== VALIDATION: cap fees to prevent impossible numbers =====
      const validated = validateAndCapFees(
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
