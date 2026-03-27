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

export function getMarketplaceTaxRate(marketplace: string): number {
  return MARKETPLACE_TAX_RATES[marketplace] ?? 0;
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
      const commBase = (item as any).commissionBase
        ? toDisplayUzs((item as any).commissionBase, marketplace)
        : undefined;
      const tariff = getTariffForProduct(tariffMap, item.offerId, itemPrice, marketplace, commBase);
      const itemCommission = tariff.commission * quantity;
      const itemLogistics = tariff.logistics * quantity;
      const itemWithdrawal = (tariff.withdrawal || 0) * quantity;
      const itemTotalFees = tariff.totalFee * quantity;
      const itemTax = itemRevenue * getMarketplaceTaxRate(marketplace);

      revenue += itemRevenue;
      costTotal += itemCostTotal;
      commission += itemCommission;
      logistics += itemLogistics;
      withdrawal += itemWithdrawal;
      totalFees += itemTotalFees;
      itemCount += quantity;
      if (rawCostPrice !== null) costCoveredItems += quantity;
      if (tariff.isReal) realTariffItems += quantity;

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
        hasRealTariff: tariff.isReal,
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
