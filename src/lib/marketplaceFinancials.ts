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

function getPositiveAmount(value: unknown): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function getSignedAmount(value: unknown): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeMarketplaceMoney(value: number, marketplace: string): number {
  return marketplace === 'wildberries' ? toDisplayUzs(value, marketplace) : value;
}

function extractDirectItemFees(item: any, marketplace: string): {
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  additionalRevenue: number;
  isReal: boolean;
} | null {
  const commissionRaw = getPositiveAmount(item.commissionAmount ?? item.commissionBase);
  const logisticsRaw = getPositiveAmount(item.deliveryAmount);
  const withdrawalRaw = getPositiveAmount(item.withdrawalAmount);
  const additionalRaw = getSignedAmount(item.additionalPayment ?? item.subsidyAmount ?? item.promoAmount);

  if (commissionRaw <= 0 && logisticsRaw <= 0 && withdrawalRaw <= 0 && additionalRaw === 0) {
    return null;
  }

  const commission = normalizeMarketplaceMoney(commissionRaw, marketplace);
  const logistics = normalizeMarketplaceMoney(logisticsRaw, marketplace);
  const withdrawal = normalizeMarketplaceMoney(withdrawalRaw, marketplace);
  const additionalRevenue = normalizeMarketplaceMoney(Math.max(0, additionalRaw), marketplace);

  return {
    commission,
    logistics,
    withdrawal,
    totalFees: commission + logistics + withdrawal,
    additionalRevenue,
    isReal: true,
  };
}

/**
 * Extract ACTUAL fees from WB order item using forPay (real seller payout).
 * WB's forPay = what the seller actually receives after ALL deductions
 * (commission + logistics + storage + penalties).
 * 
 * SUBSIDY HANDLING: When WB runs marketplace-subsidized promotions,
 * forPay can include subsidy compensation (additional_payment / supplier_promo).
 * In this case, actual_sold_price for the seller = forPay (since that's what they receive).
 * totalFees = finishedPrice - forPay (can be negative if subsidy > fees, meaning seller earns more)
 * 
 * We ALWAYS trust the finance report values (forPay, finishedPrice) as-is.
 */
function extractWBActualFees(item: any, marketplace: string): {
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  additionalRevenue: number;
  isReal: boolean;
} | null {
  if (marketplace !== 'wildberries') return null;

  const direct = extractDirectItemFees(item, marketplace);
  if (direct) return direct;
  
  const forPay = getPositiveAmount(item.forPay || item.sellerAmount);
  const finishedPrice = getPositiveAmount(item.finishedPrice || item.price || 0);
  const additionalPayment = normalizeMarketplaceMoney(
    Math.max(0, getSignedAmount(item.additionalPayment)),
    marketplace,
  );
  
  // forPay must be a positive number
  if (!forPay || forPay <= 0 || finishedPrice <= 0) return null;
  
  // Fallback when only payout is available: derive combined fees from sold price and payout.
  const feesPerUnitRub = Math.max(0, finishedPrice - forPay);
  const feesPerUnitUzs = toDisplayUzs(feesPerUnitRub, marketplace);
  
  return {
    commission: feesPerUnitUzs,
    logistics: 0,
    withdrawal: 0,
    totalFees: feesPerUnitUzs,
    additionalRevenue: additionalPayment,
    isReal: true,
  };
}

/**
 * Extract fees from Uzum order item using item-level finance data.
 * Uzum Finance API (/v1/finance/orders) returns per-item:
 *   - commissionPercent / commissionBase (commissionAmount) = actual commission
 *   - deliveryAmount / logisticsAmount = actual logistics/delivery fee
 *   - sellerAmount = net payout after all deductions
 *   - totalPrice / buyerPrice = gross sale price
 * 
 * Priority: 1) Absolute commissionBase amount  2) commissionPercent × price  3) null (fallback)
 * Logistics: deliveryAmount from finance API (NEVER hardcode defaults)
 */
function extractUzumActualFees(item: any, itemPriceUzs: number, marketplace: string): {
  commission: number;
  logistics: number;
  withdrawal: number;
  totalFees: number;
  isReal: boolean;
} | null {
  if (marketplace !== 'uzum') return null;
  
  const itemCommPercent = item.commissionPercent;
  const itemCommBase = item.commissionBase; // absolute commission amount from Finance API
  const itemDelivery = item.deliveryAmount || 0; // actual logistics from Finance API
  
  let commission = 0;
  let hasRealCommission = false;
  
  // Priority 1: Absolute commission amount from Finance API
  if (itemCommBase && itemCommBase > 0) {
    commission = itemCommBase;
    hasRealCommission = true;
  }
  // Priority 2: Commission percentage from Finance API × actual sold price
  else if (itemCommPercent && itemCommPercent > 0 && itemPriceUzs > 0) {
    commission = Math.round(itemPriceUzs * (itemCommPercent / 100));
    hasRealCommission = true;
  }
  
  // If we have EITHER real commission OR real logistics data, return it
  if (hasRealCommission || itemDelivery > 0) {
    const logistics = itemDelivery > 0 ? itemDelivery : 0;
    return {
      commission,
      logistics,
      withdrawal: 0,
      totalFees: commission + logistics,
      isReal: true,
    };
  }
  
  return null;
}

/**
 * Extract Yandex subsidy — DISABLED.
 * commissionBase was removed from order items because it caused
 * commission inflation (commission > sold price). Subsidies will be
 * handled when/if we integrate the united-netting finance report.
 */
function extractYandexSubsidy(_item: any, _marketplace: string): number {
  return 0;
}

/**
 * Validate fees — log warnings but DO NOT artificially cap.
 * Real marketplace API data must be passed through as-is.
 * The 80% cap was removed because it distorted real finance report values.
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
      let itemRevenue = itemPrice * quantity;
      const rawCostPrice = getCostPrice(marketplace, item.offerId);
      const costPriceUzs = rawCostPrice !== null ? toDisplayUzs(rawCostPrice, marketplace) : 0;
      const itemCostTotal = costPriceUzs * quantity;

      // ===== MARKETPLACE-SUBSIDIZED PROMOTION HANDLING =====
      // Add Yandex subsidy (PROMO_AMOUNT / compensation) to revenue
      const yandexSubsidy = extractYandexSubsidy(item, marketplace);
      if (yandexSubsidy > 0) {
        itemRevenue += toDisplayUzs(yandexSubsidy, marketplace) * quantity;
      }

      // ===== MARKETPLACE-SPECIFIC ACTUAL FEE EXTRACTION =====
      // Priority: 1) Actual fees from marketplace finance/settlement API → 2) Tariff-based estimation
      let itemCommission = 0;
      let itemLogistics = 0;
      let itemWithdrawal = 0;
      let itemTotalFees = 0;
      let hasRealFees = false;

      const directFees = extractDirectItemFees(item, marketplace);
      if (directFees) {
        itemRevenue += directFees.additionalRevenue * quantity;
        itemCommission = directFees.commission * quantity;
        itemLogistics = directFees.logistics * quantity;
        itemWithdrawal = directFees.withdrawal * quantity;
        itemTotalFees = directFees.totalFees * quantity;
        hasRealFees = true;
      }

      // Try WB actual fees (from forPay — includes subsidy compensation)
      const wbFees = !hasRealFees ? extractWBActualFees(item, marketplace) : null;
      if (wbFees) {
        itemRevenue += wbFees.additionalRevenue * quantity;
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
        // CRITICAL: Always use actual sold price (itemPrice) for tariff calculation.
        // Never use commissionBase — it inflates fees beyond sold price.
        const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice, marketplace);
        itemCommission = tariff.commission * quantity;
        itemLogistics = tariff.logistics * quantity;
        itemWithdrawal = (tariff.withdrawal || 0) * quantity;
        itemTotalFees = tariff.totalFee * quantity;
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
