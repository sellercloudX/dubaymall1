import { toDisplayUzs } from "@/lib/currency";

export const MARKETPLACE_CACHE_VERSION = "v25-full-enrichment-fixed";

export interface NormalizedMarketplaceFinance {
  actualCommission: number;
  actualLogisticsFee: number;
  actualOtherFees: number;
  actualSoldPrice: number; // Sellerning haqiqiy daromadi (forPay / bankSum / ppvz_for_pay)
  grossPrice: number; // Mijoz to'lagan yoki asosiy narx
  subsidyAmount: number;
  isExact: boolean;
  financeSource: string; // 'raw' | 'finance-report' | 'wb-report' | 'yandex-netting'
}

function toPositiveNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function pickFirst(item: any, ...fields: string[]): number {
  for (const field of fields) {
    if (toPositiveNumber(item[field]) > 0) return toPositiveNumber(item[field]);
  }
  // nested finance object
  const fin = item.finance || item.financeData || {};
  for (const field of fields) {
    if (toPositiveNumber(fin[field]) > 0) return toPositiveNumber(fin[field]);
  }
  return 0;
}

function sumFields(item: any, ...fields: string[]): number {
  let total = 0;
  const fin = item.finance || item.financeData || {};
  for (const field of fields) {
    total += toPositiveNumber(item[field]);
    total += toPositiveNumber(fin[field]);
  }
  return total;
}

export function normalizeMarketplaceFinance(item: any, marketplace: string): NormalizedMarketplaceFinance {
  let result: NormalizedMarketplaceFinance;

  if (marketplace === "uzum") {
    const commission = pickFirst(item, "actualCommission", "commissionAmount", "commissionBase", "commission?.amount");
    const logistics = pickFirst(
      item,
      "actualLogisticsFee",
      "deliveryAmount",
      "logisticsAmount",
      "deliveryCost",
      "logisticsFee",
    );
    const sellerRevenue = pickFirst(item, "actualSoldPrice", "sellerAmount", "forPay", "payoutAmount", "sellerPayout");
    const subsidy = sumFields(item, "subsidyAmount", "additionalPayment", "compensation", "promoAmount");

    result = {
      actualCommission: commission,
      actualLogisticsFee: logistics,
      actualOtherFees: pickFirst(item, "actualOtherFees", "withdrawalAmount", "otherFees"),
      actualSoldPrice: Math.max(sellerRevenue, sellerRevenue + subsidy),
      grossPrice: pickFirst(item, "grossPrice", "totalPrice", "buyerPrice", "price"),
      subsidyAmount: subsidy,
      isExact: commission > 0 || logistics > 0 || sellerRevenue > 0,
      financeSource: item.financeSource || "raw-uzum",
    };
  } else if (marketplace === "yandex") {
    const commission = pickFirst(item, "actualCommission", "commission", "sales_commission", "commissionAmount");
    const logistics = sumFields(item, "actualLogisticsFee", "logistics", "delivery", "transfer_fee", "shipping_cost");
    const sellerRevenue = pickFirst(item, "actualSoldPrice", "bankSum", "transactionSum", "sellerAmount");
    const subsidy = sumFields(item, "subsidyAmount", "PROMO_AMOUNT", "compensation");

    result = {
      actualCommission: commission,
      actualLogisticsFee: logistics,
      actualOtherFees: sumFields(item, "otherFees", "paymentTransferAmount"),
      actualSoldPrice: Math.max(sellerRevenue, sellerRevenue + subsidy),
      grossPrice: pickFirst(item, "grossPrice", "customer_payment_amount", "buyerPrice"),
      subsidyAmount: subsidy,
      isExact: commission > 0 || logistics > 0 || sellerRevenue > 0,
      financeSource: item.financeSource || "raw-yandex",
    };
  } else if (marketplace === "wildberries") {
    const commission = pickFirst(item, "actualCommission", "ppvz_sales_commission", "commission");
    const logistics = sumFields(item, "actualLogisticsFee", "logistics", "delivery_rub", "deliveryAmount");
    const sellerRevenue = pickFirst(item, "actualSoldPrice", "forPay", "ppvz_for_pay", "sellerAmount");
    const subsidy = sumFields(item, "subsidyAmount", "supplier_promo", "product_discount_for_report");

    result = {
      actualCommission: commission,
      actualLogisticsFee: logistics,
      actualOtherFees: sumFields(item, "otherFees", "storage_fee", "penalty"),
      actualSoldPrice: Math.max(sellerRevenue, sellerRevenue + subsidy),
      grossPrice: pickFirst(item, "grossPrice", "finishedPrice", "retail_price_withdisc_rub"),
      subsidyAmount: subsidy,
      isExact: commission > 0 || logistics > 0 || sellerRevenue > 0,
      financeSource: item.financeSource || "raw-wb",
    };
  } else {
    result = {
      actualCommission: 0,
      actualLogisticsFee: 0,
      actualOtherFees: 0,
      actualSoldPrice: 0,
      grossPrice: 0,
      subsidyAmount: 0,
      isExact: false,
      financeSource: "unknown",
    };
  }

  return result;
}
