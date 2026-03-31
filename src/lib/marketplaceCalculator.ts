/**
 * UNIFIED Marketplace Calculator — Single Source of Truth.
 * 
 * ALL financial metrics (PnL, ABC, Sales, UnitEconomy, Products) MUST use this.
 * No other file should do commission/logistics/PnL math independently.
 */

import { getRubToUzs, isRubMarketplace } from "@/lib/currency";

// ============ CONSTANTS ============

/** Minimum logistics per marketplace (in native currency) */
const MIN_LOGISTICS: Record<string, number> = {
  yandex: 2000,    // 2000 so'm
  uzum: 5000,      // 5000 so'm
  wildberries: 46,  // 46 RUB
};

/** UZB YATT tax rate */
const UZB_TAX_RATE = 0.04;

// ============ TYPES ============

export interface MarketplaceMetrics {
  /** Per-unit values (in UZS) */
  price: number;
  costPrice: number;
  commission: number;
  logistics: number;
  otherFees: number;
  totalFees: number;
  tax: number;
  grossProfit: number;
  netProfit: number;
  margin: number;
  
  /** Aggregate values (quantity-multiplied, in UZS) */
  quantity: number;
  totalRevenue: number;
  totalCost: number;
  totalCommission: number;
  totalLogistics: number;
  totalOtherFees: number;
  totalAllFees: number;
  totalTax: number;
  totalGrossProfit: number;
  totalNetProfit: number;
}

export interface CalcInput {
  marketplace: string;
  /** Price in marketplace native currency */
  priceNative: number;
  /** Cost price in marketplace native currency (0 if unknown) */
  costNative: number;
  /** Commission % (e.g. 18.5 for 18.5%) */
  commissionPercent: number;
  /** Logistics in marketplace native currency */
  logisticsNative: number;
  /** Other fees in native currency (payment transfer, etc.) */
  otherFeesNative: number;
  /** Quantity */
  quantity: number;
}

// ============ CORE CALCULATOR ============

/**
 * Calculate all marketplace metrics from raw inputs.
 * Returns values in UZS.
 */
export function calcMarketplaceMetrics(input: CalcInput): MarketplaceMetrics {
  const { marketplace, priceNative, costNative, commissionPercent, logisticsNative, otherFeesNative, quantity } = input;
  
  const rate = isRubMarketplace(marketplace) ? getRubToUzs() : 1;
  const minLogisticsNative = MIN_LOGISTICS[marketplace] || 0;
  
  // Enforce minimum logistics
  const enforcedLogisticsNative = Math.max(logisticsNative, minLogisticsNative);
  
  // Convert to UZS
  const price = Math.round(priceNative * rate);
  const costPrice = Math.round(costNative * rate);
  const commission = Math.round((priceNative * commissionPercent / 100) * rate);
  const logistics = Math.round(enforcedLogisticsNative * rate);
  const otherFees = Math.round(otherFeesNative * rate);
  const totalFees = commission + logistics + otherFees;
  const tax = Math.round(price * UZB_TAX_RATE);
  const grossProfit = price - costPrice;
  const netProfit = grossProfit - totalFees - tax;
  const margin = price > 0 ? Math.round((netProfit / price) * 10000) / 100 : 0;
  
  const qty = Math.max(quantity, 1);
  
  return {
    price,
    costPrice,
    commission,
    logistics,
    otherFees,
    totalFees,
    tax,
    grossProfit,
    netProfit,
    margin,
    
    quantity: qty,
    totalRevenue: price * qty,
    totalCost: costPrice * qty,
    totalCommission: commission * qty,
    totalLogistics: logistics * qty,
    totalOtherFees: otherFees * qty,
    totalAllFees: totalFees * qty,
    totalTax: tax * qty,
    totalGrossProfit: grossProfit * qty,
    totalNetProfit: netProfit * qty,
  };
}

/**
 * Get the minimum logistics for a marketplace in UZS.
 */
export function getMinLogisticsUzs(marketplace: string): number {
  const native = MIN_LOGISTICS[marketplace] || 0;
  const rate = isRubMarketplace(marketplace) ? getRubToUzs() : 1;
  return Math.round(native * rate);
}

/**
 * Enforce minimum logistics on a raw value (native currency).
 */
export function enforceMinLogistics(logisticsNative: number, marketplace: string): number {
  return Math.max(logisticsNative, MIN_LOGISTICS[marketplace] || 0);
}
