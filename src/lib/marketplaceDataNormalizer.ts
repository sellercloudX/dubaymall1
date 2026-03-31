import { toDisplayUzs } from '@/lib/currency';

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

function getFirstPositiveNumber(...values: unknown[]): number {
  for (const value of values) {
    const amount = toPositiveNumber(value);
    if (amount > 0) return amount;
  }
  return 0;
}

function getPositiveSum(...values: unknown[]): number {
  return values.reduce((sum, value) => sum + toPositiveNumber(value), 0);
}

function normalizeMarketplaceMoney(value: number, marketplace: string): number {
  return marketplace === 'wildberries' ? toDisplayUzs(value, marketplace) : value;
}

export function parseUzumFinance(item: any): NormalizedMarketplaceFinance {
  const actualCommission = getFirstPositiveNumber(
    item.actualCommission,
    item.commissionAmount,
    item.commission?.amount,
    item.commissionBase,
  );
  const actualLogisticsFee = getFirstPositiveNumber(
    item.actualLogisticsFee,
    item.deliveryAmount,
    item.logisticsAmount,
    item.deliveryCost,
    item.logisticsFee,
  );
  const actualOtherFees = getFirstPositiveNumber(
    item.actualOtherFees,
    item.withdrawalAmount,
    item.otherFees,
  );
  const subsidyAmount = getPositiveSum(
    item.subsidyAmount,
    item.additionalPayment,
    item.additional_payment,
    item.compensationAmount,
    item.compensation,
    item.promoAmount,
  );
  const sellerRevenue = getFirstPositiveNumber(
    item.actualSoldPrice,
    item.sellerAmount,
    item.forPay,
    item.payoutAmount,
    item.sellerPayout,
  );
  const grossPrice = getFirstPositiveNumber(
    item.grossPrice,
    item.totalPrice,
    item.buyerPrice,
  );

  return {
    actualCommission,
    actualLogisticsFee,
    actualOtherFees,
    actualSoldPrice: sellerRevenue > 0 || subsidyAmount > 0 ? sellerRevenue + subsidyAmount : 0,
    grossPrice,
    subsidyAmount,
    isExact:
      actualCommission > 0 ||
      actualLogisticsFee > 0 ||
      actualOtherFees > 0 ||
      sellerRevenue > 0 ||
      subsidyAmount > 0,
  };
}

export function parseYandexFinance(item: any): NormalizedMarketplaceFinance {
  const actualCommission = getFirstPositiveNumber(
    item.actualCommission,
    item.commission,
    item.sales_commission,
    item.salesCommission,
    item.commissionAmount,
    item.feeAmount,
  );
  const actualLogisticsFee = getPositiveSum(
    item.actualLogisticsFee,
    item.logistics,
    item.delivery,
    item.transfer_fee,
    item.transferFee,
    item.shipping_cost,
    item.shippingCost,
    item.deliveryAmount,
    item.deliveryCost,
  );
  const actualOtherFees = getPositiveSum(
    item.actualOtherFees,
    item.otherFees,
    item.withdrawalAmount,
    item.paymentTransferAmount,
  );
  const subsidyAmount = getPositiveSum(
    item.subsidyAmount,
    item.subsidy,
    item.promoAmount,
    item.PROMO_AMOUNT,
    item.compensation,
    item.compensationAmount,
    item.additionalPayment,
  );
  const sellerRevenue = getFirstPositiveNumber(
    item.actualSoldPrice,
    item.bankSum,
    item.sellerAmount,
    item.transactionSum,
    item.forPay,
  );
  const grossPrice = getFirstPositiveNumber(
    item.grossPrice,
    item.customer_payment_amount,
    item.customerPaymentAmount,
    item.buyerPaymentAmount,
    item.totalPrice,
    item.buyerPrice,
  );

  return {
    actualCommission,
    actualLogisticsFee,
    actualOtherFees,
    actualSoldPrice: sellerRevenue > 0 || subsidyAmount > 0 ? sellerRevenue + subsidyAmount : 0,
    grossPrice,
    subsidyAmount,
    isExact:
      actualCommission > 0 ||
      actualLogisticsFee > 0 ||
      actualOtherFees > 0 ||
      sellerRevenue > 0 ||
      subsidyAmount > 0,
  };
}

export function parseWildberriesFinance(item: any): NormalizedMarketplaceFinance {
  const actualCommissionRub = getFirstPositiveNumber(
    item.actualCommission,
    item.ppvz_sales_commission,
    item.commissionAmount,
    item.commission,
  );
  const actualLogisticsRub = getPositiveSum(
    item.actualLogisticsFee,
    item.logistics,
    item.delivery_rub,
    item.deliveryAmount,
    item.logisticsAmount,
  );
  const actualOtherFeesRub = getPositiveSum(
    item.actualOtherFees,
    item.payment_sale_amount,
    item.payment_schedule,
    item.storage_fee,
    item.penalty,
    item.acceptance,
    item.withdrawalAmount,
  );
  const subsidyRub = getPositiveSum(
    item.subsidyAmount,
    item.supplier_promo,
    item.product_discount_for_report,
    item.additional_payment,
    item.additionalPayment,
  );
  const sellerRevenueRub = getFirstPositiveNumber(
    item.actualSoldPrice,
    item.forPay,
    item.ppvz_for_pay,
    item.sellerAmount,
  );
  const grossPriceRub = getFirstPositiveNumber(
    item.grossPrice,
    item.finishedPrice,
    item.retail_price_withdisc_rub,
    item.priceWithDisc,
    item.totalPrice,
    item.price,
  );

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
    isExact:
      actualCommissionRub > 0 ||
      actualLogisticsRub > 0 ||
      actualOtherFeesRub > 0 ||
      sellerRevenueRub > 0 ||
      subsidyRub > 0,
  };
}

export function normalizeMarketplaceFinance(item: any, marketplace: string): NormalizedMarketplaceFinance {
  if (marketplace === 'uzum') return parseUzumFinance(item);
  if (marketplace === 'yandex') return parseYandexFinance(item);
  if (marketplace === 'wildberries') return parseWildberriesFinance(item);

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