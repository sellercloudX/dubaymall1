/**
 * Unified revenue calculation for SellerCloudX.
 * 
 * ALL components MUST use these functions to prevent metric inconsistencies.
 * 
 * Revenue rule: Use item-level calculation (price * count) as the source of truth,
 * falling back to order.total only when items are missing.
 * 
 * Excluded statuses: CANCELLED, CANCELED, RETURNED, REJECTED
 */

import { toDisplayUzs } from '@/lib/currency';
import type { MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';

const EXCLUDED_STATUSES = new Set(['CANCELLED', 'CANCELED', 'RETURNED', 'REJECTED']);

/** Check if an order should be excluded from revenue calculations */
export function isExcludedOrder(order: MarketplaceOrder): boolean {
  return EXCLUDED_STATUSES.has(String(order.status).toUpperCase());
}

/**
 * Get the revenue of a single order in its native currency.
 * Prefers item-level aggregation for accuracy; falls back to order.total.
 */
export function getOrderRevenueNative(order: MarketplaceOrder): number {
  // Item-level: most accurate (handles multi-item orders)
  if (order.items && order.items.length > 0) {
    const hasExactSoldPrice = order.items.some(item => item.actualSoldPrice !== undefined);
    const itemTotal = order.items.reduce(
      (sum, item) => sum + (hasExactSoldPrice
        ? (item.actualSoldPrice || 0)
        : (item.price || 0) * (item.count || 1)),
      0
    );
    if (itemTotal > 0 || hasExactSoldPrice) return itemTotal;
  }
  // Fallback chain
  return order.total || order.itemsTotal || 0;
}

/**
 * Get the revenue of a single order converted to UZS (display currency).
 */
export function getOrderRevenueUzs(order: MarketplaceOrder, marketplace: string): number {
  return toDisplayUzs(getOrderRevenueNative(order), marketplace);
}

/**
 * Calculate total revenue across orders (in UZS) for given marketplaces.
 * Excludes cancelled/returned orders.
 */
export function calculateTotalRevenue(
  getOrders: (mp: string) => MarketplaceOrder[],
  marketplaces: string[],
): number {
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
 * Build a Map<orderId, marketplace> for efficient lookup.
 */
export function buildOrderMarketplaceMap(
  getOrders: (mp: string) => MarketplaceOrder[],
  marketplaces: string[],
): Map<number, string> {
  const map = new Map<number, string>();
  for (const mp of marketplaces) {
    for (const order of getOrders(mp)) {
      map.set(order.id, mp);
    }
  }
  return map;
}
