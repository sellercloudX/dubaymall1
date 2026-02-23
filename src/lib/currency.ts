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

// 1 RUB = 140 UZS (configurable, can be replaced with API call later)
export const RUB_TO_UZS = 140;
export const UZS_TO_RUB = 1 / RUB_TO_UZS;

export const isRubMarketplace = (mp: string) => mp === 'wildberries';

/** Convert marketplace-native amount to UZS for display in SellerCloudX */
export function toDisplayUzs(amount: number, marketplace: string): number {
  return isRubMarketplace(marketplace) ? amount * RUB_TO_UZS : amount;
}

/** Convert UZS amount to marketplace-native currency (RUB for WB, UZS for others) */
export function toMarketplaceCurrency(amountUzs: number, marketplace: string): number {
  return isRubMarketplace(marketplace) ? Math.round(amountUzs * UZS_TO_RUB) : amountUzs;
}

/** Convert RUB to UZS */
export function rubToUzs(rub: number): number {
  return rub * RUB_TO_UZS;
}

/** Convert UZS to RUB */
export function uzsToRub(uzs: number): number {
  return uzs * UZS_TO_RUB;
}

/** Format price in UZS (so'm) for display */
export function formatUzs(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return (amount / 1_000_000).toFixed(1) + ' mln';
  if (Math.abs(amount) >= 1_000) return (amount / 1_000).toFixed(0) + ' ming';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount));
}

/** Format price with "so'm" suffix */
export function formatUzsFull(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return (amount / 1_000_000).toFixed(2) + " mln so'm";
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " so'm";
}

/** Get currency symbol for a marketplace (for raw display only) */
export function getCurrencySymbol(marketplace: string): string {
  return isRubMarketplace(marketplace) ? '₽' : "so'm";
}
