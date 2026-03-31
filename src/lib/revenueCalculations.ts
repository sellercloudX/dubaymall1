/**
 * Unified revenue calculation for SellerCloudX.
 * ALL components MUST use these functions.
 */

import { toDisplayUzs } from "@/lib/currency";
import type { MarketplaceOrder } from "@/hooks/useMarketplaceDataStore";

const EXCLUDED_STATUSES = new Set(["CANCELLED", "CANCELED", "RETURNED", "REJECTED", "BEKOR", "VOZVRAT"]);

/** Check if an order should be excluded from revenue calculations */
export function isExcludedOrder(order: MarketplaceOrder): boolean {
  const status = String(order.status || "")
    .toUpperCase()
    .trim();
  return EXCLUDED_STATUSES.has(status);
}

/**
 * Get the TRUE seller revenue of a single order (native currency).
 * Priority:
 * 1. actualSoldPrice (from finance enrichment)
 * 2. sellerAmount / forPay / ppvz_for_pay / bankSum
 * 3. item-level price * count
 * 4. order.total as last fallback
 */
export function getOrderRevenueNative(order: MarketplaceOrder): number {
  if (!order.items || order.items.length === 0) {
    return order.total || order.itemsTotal || 0;
  }

  let totalRevenue = 0;

  for (const item of order.items) {
    // 1. Eng ishonchli — finance dan kelgan actualSoldPrice
    if (typeof item.actualSoldPrice === "number" && item.actualSoldPrice > 0) {
      totalRevenue += item.actualSoldPrice * (item.count || 1);
      continue;
    }

    // 2. Seller ga to‘lanadigan haqiqiy summa (eng muhim!)
    const sellerPayout =
      item.sellerAmount || item.forPay || item.ppvz_for_pay || item.bankSum || item.payoutAmount || 0;

    if (sellerPayout > 0) {
      totalRevenue += sellerPayout * (item.count || 1);
      continue;
    }

    // 3. Oddiy item narxi (agar yuqoridagilar bo‘lmasa)
    const itemPrice = item.price || 0;
    totalRevenue += itemPrice * (item.count || 1);
  }

  // Agar itemlardan hech narsa chiqmasa — order darajasidagi total ni ishlat
  return totalRevenue > 0 ? totalRevenue : order.total || order.itemsTotal || 0;
}

/**
 * Get revenue in UZS (display currency)
 */
export function getOrderRevenueUzs(order: MarketplaceOrder, marketplace: string): number {
  return toDisplayUzs(getOrderRevenueNative(order), marketplace);
}

/**
 * Calculate total revenue across orders (in UZS)
 * Excludes cancelled/returned orders.
 */
export function calculateTotalRevenue(getOrders: (mp: string) => MarketplaceOrder[], marketplaces: string[]): number {
  let total = 0;
  for (const mp of marketplaces) {
    for (const order of getOrders(mp)) {
      if (isExcludedOrder(order)) continue;
      total += getOrderRevenueUzs(order, mp);
    }
  }
  return total;
}

/**
 * Build orderId → marketplace map
 */
export function buildOrderMarketplaceMap(
  getOrders: (mp: string) => MarketplaceOrder[],
  marketplaces: string[],
): Map<number | string, string> {
  const map = new Map<number | string, string>();
  for (const mp of marketplaces) {
    for (const order of getOrders(mp)) {
      if (order.id) map.set(order.id, mp);
    }
  }
  return map;
}
