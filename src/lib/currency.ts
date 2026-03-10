/**
 * Centralized currency conversion for SellerCloudX.
 * 
 * WB (Wildberries) operates in RUB (₽).
 * Yandex, Uzum operate in UZS (so'm).
 * SellerCloudX displays EVERYTHING in UZS (so'm).
 * 
 * When sending prices to WB API → convert UZS to RUB.
 * When displaying WB data in SellerCloudX → convert RUB to UZS.
 */

// Dynamic exchange rate — updated from CBU.uz via useExchangeRate hook
let _rubToUzs = 140; // Default fallback

/** Get current RUB→UZS rate */
export function getRubToUzs(): number { return _rubToUzs; }

/** Update rate (called from useExchangeRate hook) */
export function setRubToUzs(rate: number) {
  if (rate > 0) {
    _rubToUzs = Math.round(rate * 100) / 100;
    
  }
}

/** @deprecated Use getRubToUzs() for dynamic rate. Kept for backward compat in static imports. */
export const RUB_TO_UZS = 140;

export const isRubMarketplace = (mp: string) => mp === 'wildberries';

/** Convert marketplace-native amount to UZS for display in SellerCloudX — always rounded to whole so'm */
export function toDisplayUzs(amount: number, marketplace: string): number {
  const result = isRubMarketplace(marketplace) ? amount * _rubToUzs : amount;
  return Math.round(result);
}

/** Convert UZS amount to marketplace-native currency (RUB for WB, UZS for others) */
export function toMarketplaceCurrency(amountUzs: number, marketplace: string): number {
  return isRubMarketplace(marketplace) ? Math.round(amountUzs / _rubToUzs) : amountUzs;
}

/** Convert RUB to UZS */
export function rubToUzs(rub: number): number {
  return rub * _rubToUzs;
}

/** Convert UZS to RUB */
export function uzsToRub(uzs: number): number {
  return uzs / _rubToUzs;
}

/** Format price in UZS (so'm) for display — always rounds to whole so'm (no tiyinlar) */
export function formatUzs(amount: number): string {
  const rounded = Math.round(amount);
  if (Math.abs(rounded) >= 1_000_000) return (Math.round(rounded / 100_000) / 10).toFixed(1) + ' mln';
  if (Math.abs(rounded) >= 1_000) return Math.round(rounded / 1_000) + ' ming';
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(rounded);
}

/** Format price with "so'm" suffix — always whole so'm */
export function formatUzsFull(amount: number): string {
  const rounded = Math.round(amount);
  if (Math.abs(rounded) >= 1_000_000) return (Math.round(rounded / 100_000) / 10).toFixed(1) + " mln so'm";
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(rounded) + " so'm";
}

/** Get currency symbol for a marketplace (for raw display only) */
export function getCurrencySymbol(marketplace: string): string {
  return isRubMarketplace(marketplace) ? '₽' : "so'm";
}
