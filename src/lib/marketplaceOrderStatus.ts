import type { MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';

export type OrderStatusCategory = 'all' | 'new' | 'assembly' | 'active' | 'delivered' | 'cancelled';

const CANCELLED_KEYWORDS = ['CANCEL', 'REJECT', 'RETURN', 'ВОЗВРАТ', 'ОТМЕН', 'BEKOR'];
const DELIVERED_STATUSES = new Set(['DELIVERED', 'COMPLETED']);
const NEW_STATUSES = new Set(['NEW', 'PENDING', 'RESERVED', 'UNPAID', 'CREATED', 'STARTED', 'AWAITING_PAYMENT']);
const ASSEMBLY_STATUSES = new Set(['PROCESSING', 'PACKING', 'CONFIRM', 'READY_TO_SHIP', 'ACCEPTED_AT_DP', 'ACCEPTED']);
const ACTIVE_STATUSES = new Set(['DELIVERY', 'DELIVERING', 'PENDING_DELIVERY', 'SHIPPED', 'PICKUP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT']);
const YANDEX_ASSEMBLY_SUBSTATUSES = new Set(['READY_TO_SHIP', 'SHIPPED']);
const YANDEX_NEW_SUBSTATUSES = new Set(['STARTED', 'PENDING', '']);

export function getMarketplaceOrderStatusCategory(
  order: Pick<MarketplaceOrder, 'status' | 'substatus'>,
  marketplace?: string,
): Exclude<OrderStatusCategory, 'all'> {
  const status = String(order.status || '').toUpperCase().trim();
  const substatus = String(order.substatus || '').toUpperCase().trim();
  const combined = `${status} ${substatus}`;

  if (CANCELLED_KEYWORDS.some((keyword) => combined.includes(keyword))) {
    return 'cancelled';
  }

  if (DELIVERED_STATUSES.has(status)) {
    return 'delivered';
  }

  if (marketplace === 'yandex') {
    if (status === 'PENDING') {
      return 'new';
    }

    if (status === 'PROCESSING') {
      if (YANDEX_ASSEMBLY_SUBSTATUSES.has(substatus)) {
        return 'assembly';
      }

      if (YANDEX_NEW_SUBSTATUSES.has(substatus) || !substatus) {
        return 'new';
      }

      return 'new';
    }
  }

  if (NEW_STATUSES.has(status)) {
    return 'new';
  }

  if (ASSEMBLY_STATUSES.has(status)) {
    return 'assembly';
  }

  if (ACTIVE_STATUSES.has(status)) {
    return 'active';
  }

  return 'active';
}
