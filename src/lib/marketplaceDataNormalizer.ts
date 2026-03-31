import { toDisplayUzs } from '@/lib/currency';

export const MARKETPLACE_CACHE_VERSION = 'v23-finance-fallback-fixed';

export interface NormalizedMarketplaceFinance {
  actualCommission: number;
  actualLogisticsFee: number;
  actualOtherFees: number;
  actualSoldPrice: number;
  grossPrice: number;
  subsidyAmount: number;
  isExact: boolean;
}

function toFiniteNumber(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toPositiveNumber(value: unknown): number {
  const amount = toFiniteNumber(value);
  return amount > 0 ? amount : 0;
}

/**
 * Pick first positive number from a list of candidates.
 * Checks both direct field and nested finance.field for each candidate.
 */
function pickFirst(item: any, ...fieldNames: string[]): number {
  // First pass: direct fields
  for (const field of fieldNames) {
    const v = toPositiveNumber(item[field]);
    if (v > 0) return v;
  }
  // Second pass: nested finance.* fields
  const fin = item.finance || item.financeData || {};
  for (const field of fieldNames) {
    const v = toPositiveNumber(fin[field]);
    if (v > 0) return v;
  }
  return 0;
}

function sumFields(item: any, ...fieldNames: string[]): number {
  let total = 0;
  const fin = item.finance || item.financeData || {};
  for (const field of fieldNames) {
    total += toPositiveNumber(item[field]);
    total += toPositiveNumber(fin[field]);
  }
  return total;
}

function normalizeMarketplaceMoney(value: number, marketplace: string): number {
  return marketplace === 'wildberries' ? toDisplayUzs(value, marketplace) : value;
}

export function parseUzumFinance(item: any): NormalizedMarketplaceFinance {
  const actualCommission = pickFirst(item,
    'actualCommission',
    'commissionAmount',
    'commissionBase',
  );
  // Also check commission.amount pattern
  const commissionObj = item.commission || item.finance?.commission;
  const commissionObjAmount = toPositiveNumber(
    typeof commissionObj === 'object' ? commissionObj?.amount : 0
  );
  const finalCommission = actualCommission > 0 ? actualCommission : commissionObjAmount;

  const actualLogisticsFee = pickFirst(item,
    'actualLogisticsFee',
    'deliveryAmount',
    'logisticsAmount',
    'deliveryCost',
    'logisticsFee',
  );
  const actualOtherFees = pickFirst(item,
    'actualOtherFees',
    'withdrawalAmount',
    'otherFees',
  );
  const subsidyAmount = sumFields(item,
    'subsidyAmount',
    'additionalPayment',
    'additional_payment',
    'compensationAmount',
    'compensation',
    'promoAmount',
  );
  const sellerRevenue = pickFirst(item,
    'actualSoldPrice',
    'sellerAmount',
    'forPay',
    'payoutAmount',
    'sellerPayout',
  );
  const grossPrice = pickFirst(item,
    'grossPrice',
    'totalPrice',
    'buyerPrice',
  );

  const hasAnyData = finalCommission > 0 || actualLogisticsFee > 0 || actualOtherFees > 0 || sellerRevenue > 0 || subsidyAmount > 0;

  return {
    actualCommission: finalCommission,
    actualLogisticsFee,
    actualOtherFees,
    actualSoldPrice: sellerRevenue > 0 || subsidyAmount > 0 ? sellerRevenue + subsidyAmount : 0,
    grossPrice,
    subsidyAmount,
    isExact: hasAnyData,
  };
}

export function parseYandexFinance(item: any): NormalizedMarketplaceFinance {
  const actualCommission = pickFirst(item,
    'actualCommission',
    'commission',
    'sales_commission',
    'salesCommission',
    'commissionAmount',
    'feeAmount',
  );
  const actualLogisticsFee = sumFields(item,
    'actualLogisticsFee',
    'logistics',
    'delivery',
    'transfer_fee',
    'transferFee',
    'shipping_cost',
    'shippingCost',
    'deliveryAmount',
    'deliveryCost',
  );
  const actualOtherFees = sumFields(item,
    'actualOtherFees',
    'otherFees',
    'withdrawalAmount',
    'paymentTransferAmount',
  );
  const subsidyAmount = sumFields(item,
    'subsidyAmount',
    'subsidy',
    'promoAmount',
    'PROMO_AMOUNT',
    'compensation',
    'compensationAmount',
    'additionalPayment',
  );
  const sellerRevenue = pickFirst(item,
    'actualSoldPrice',
    'bankSum',
    'sellerAmount',
    'transactionSum',
    'forPay',
  );
  const grossPrice = pickFirst(item,
    'grossPrice',
    'customer_payment_amount',
    'customerPaymentAmount',
    'buyerPaymentAmount',
    'totalPrice',
    'buyerPrice',
  );

  const hasAnyData = actualCommission > 0 || actualLogisticsFee > 0 || actualOtherFees > 0 || sellerRevenue > 0 || subsidyAmount > 0;

  return {
    actualCommission,
    actualLogisticsFee,
    actualOtherFees,
    actualSoldPrice: sellerRevenue > 0 || subsidyAmount > 0 ? sellerRevenue + subsidyAmount : 0,
    grossPrice,
    subsidyAmount,
    isExact: hasAnyData,
  };
}

export function parseWildberriesFinance(item: any): NormalizedMarketplaceFinance {
  const actualCommissionRub = pickFirst(item,
    'actualCommission',
    'ppvz_sales_commission',
    'commissionAmount',
    'commission',
  );
  const actualLogisticsRub = sumFields(item,
    'actualLogisticsFee',
    'logistics',
    'delivery_rub',
    'deliveryAmount',
    'logisticsAmount',
  );
  const actualOtherFeesRub = sumFields(item,
    'actualOtherFees',
    'payment_sale_amount',
    'payment_schedule',
    'storage_fee',
    'penalty',
    'acceptance',
    'withdrawalAmount',
  );
  const subsidyRub = sumFields(item,
    'subsidyAmount',
    'supplier_promo',
    'product_discount_for_report',
    'additional_payment',
    'additionalPayment',
  );
  const sellerRevenueRub = pickFirst(item,
    'actualSoldPrice',
    'forPay',
    'ppvz_for_pay',
    'sellerAmount',
  );
  const grossPriceRub = pickFirst(item,
    'grossPrice',
    'finishedPrice',
    'retail_price_withdisc_rub',
    'priceWithDisc',
    'totalPrice',
    'price',
  );

  const hasAnyData = actualCommissionRub > 0 || actualLogisticsRub > 0 || actualOtherFeesRub > 0 || sellerRevenueRub > 0 || subsidyRub > 0;

  return {
    actualCommission: normalizeMarketplaceMoney(actualCommissionRub, 'wildberries'),
    actualLogisticsFee: normalizeMarketplaceMoney(actualLogisticsRub, 'wildberries'),
    actualOtherFees: normalizeMarketplaceMoney(actualOtherFeesRub, 'wildberries'),
    actualSoldPrice: normalizeMarketplaceMoney(
      sellerRevenueRub > 0 || subsidyRub > 0 ? sellerRevenueRub + subsidyRub : 0,
      'wildberries',
    ),
    grossPrice: normalizeMarketplaceMoney(grossPriceRub, 'wildberries'),
    subsidyAmount: normalizeMarketplaceMoney(subsidyRub, 'wildberries'),
    isExact: hasAnyData,
  };
}

// Debug counter — log first N items per marketplace per session to avoid console spam
const _debugCounts: Record<string, number> = {};
const DEBUG_LOG_LIMIT = 5;

export function normalizeMarketplaceFinance(item: any, marketplace: string): NormalizedMarketplaceFinance {
  let result: NormalizedMarketplaceFinance;

  if (marketplace === 'uzum') result = parseUzumFinance(item);
  else if (marketplace === 'yandex') result = parseYandexFinance(item);
  else if (marketplace === 'wildberries') result = parseWildberriesFinance(item);
  else {
    return {
      actualCommission: 0,
      actualLogisticsFee: 0,
      actualOtherFees: 0,
      actualSoldPrice: 0,
      grossPrice: 0,
      subsidyAmount: 0,
      isExact: false,
    };
  }

  // Debug logging for verification
  const key = marketplace;
  _debugCounts[key] = (_debugCounts[key] || 0) + 1;
  if (_debugCounts[key] <= DEBUG_LOG_LIMIT) {
    const offerId = item.offerId || item.skuId || item.id || '?';
    console.log(
      `[NORMALIZER_DEBUG] ${marketplace} #${_debugCounts[key]} offerId=${offerId} isExact=${result.isExact}`,
      '\n  RAW fields:',
      {
        commissionAmount: item.commissionAmount,
        'commission?.amount': item.commission?.amount,
        commissionBase: item.commissionBase,
        actualCommission: item.actualCommission,
        deliveryAmount: item.deliveryAmount,
        logisticsAmount: item.logisticsAmount,
        deliveryCost: item.deliveryCost,
        logisticsFee: item.logisticsFee,
        actualLogisticsFee: item.actualLogisticsFee,
        sellerAmount: item.sellerAmount,
        forPay: item.forPay,
        ppvz_for_pay: item.ppvz_for_pay,
        bankSum: item.bankSum,
        subsidyAmount: item.subsidyAmount,
        additionalPayment: item.additionalPayment,
        promoAmount: item.promoAmount,
        ppvz_sales_commission: item.ppvz_sales_commission,
        logistics: item.logistics,
        financeSource: item.financeSource,
      },
      '\n  NORMALIZED:',
      result,
    );
  }

  return result;
}
