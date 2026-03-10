import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dispatchNotification } from '@/lib/notificationDispatch';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { MARKETPLACE_NAMES } from '@/lib/marketplaceConfig';

const LOW_STOCK_THRESHOLD = 5;

/**
 * Auto-dispatches Telegram notifications when:
 * 1. New orders are detected (order count increases)
 * 2. Products with critically low stock are found
 * 
 * Uses refs to track previous state and avoid duplicate notifications.
 */
export function useAutoNotifications(
  connectedMarketplaces: string[],
  store: MarketplaceDataStore
) {
  const { user } = useAuth();
  const prevOrderCountRef = useRef<Record<string, number>>({});
  const lowStockNotifiedRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!user?.id || store.isLoading || connectedMarketplaces.length === 0) return;

    // Skip first load to avoid notifying on existing data
    if (initialLoadRef.current) {
      // Capture initial state
      for (const mp of connectedMarketplaces) {
        const orders = store.getOrders(mp);
        prevOrderCountRef.current[mp] = orders.length;
      }
      initialLoadRef.current = false;
      return;
    }

    // ============ Check for new orders ============
    for (const mp of connectedMarketplaces) {
      const orders = store.getOrders(mp);
      const prevCount = prevOrderCountRef.current[mp] || 0;
      const newCount = orders.length;

      if (newCount > prevCount && prevCount > 0) {
        const diff = newCount - prevCount;
        const mpName = MARKETPLACE_NAMES[mp] || mp;
        dispatchNotification(
          user.id,
          'new_order',
          `🛒 ${diff} ta yangi buyurtma`,
          `${mpName} da ${diff} ta yangi buyurtma keldi. Jami: ${newCount} ta buyurtma.`
        );
      }
      prevOrderCountRef.current[mp] = newCount;
    }

    // ============ Check for low stock ============
    for (const mp of connectedMarketplaces) {
      const products = store.getProducts(mp);
      const lowStockItems = products.filter(p => {
        const stock = p.stockCount ?? p.stockFBO ?? p.stockFBS ?? 999;
        return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
      });

      for (const item of lowStockItems) {
        const key = `${mp}-${item.offerId}`;
        if (lowStockNotifiedRef.current.has(key)) continue;
        lowStockNotifiedRef.current.add(key);

        const stock = item.stockCount ?? item.stockFBO ?? item.stockFBS ?? 0;
        const mpName = MARKETPLACE_NAMES[mp] || mp;
        dispatchNotification(
          user.id,
          'low_stock',
          `📦 Kam qoldiq: ${item.name?.substring(0, 40) || item.offerId}`,
          `${mpName}: "${item.name || item.offerId}" — faqat ${stock} dona qoldi!`
        );
      }
    }
  }, [store.dataVersion, user?.id, connectedMarketplaces.length]);
}
