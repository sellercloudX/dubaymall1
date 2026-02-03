import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SellerStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  totalViews: number;
  conversionRate: number;
  lowStockProducts: number;
  revenueByDay: { date: string; revenue: number; orders: number }[];
  topProducts: { id: string; name: string; sales: number; revenue: number }[];
  recentOrders: {
    id: string;
    order_number: string;
    total_amount: number;
    status: string;
    created_at: string;
    items_count: number;
  }[];
}

export function useSellerStats(shopId: string | null) {
  return useQuery({
    queryKey: ['seller-stats', shopId],
    queryFn: async (): Promise<SellerStats> => {
      if (!shopId) {
        return getEmptyStats();
      }

      // Get products for this shop
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity, view_count')
        .eq('shop_id', shopId);

      const productIds = products?.map(p => p.id) || [];

      // Get order items for these products
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          product_name,
          quantity,
          subtotal,
          order_id,
          orders (
            id,
            order_number,
            total_amount,
            status,
            created_at
          )
        `)
        .in('product_id', productIds);

      // Calculate stats
      const ordersMap = new Map<string, {
        id: string;
        order_number: string;
        total_amount: number;
        status: string;
        created_at: string;
        items_count: number;
        shop_revenue: number;
      }>();

      orderItems?.forEach(item => {
        const order = item.orders as any;
        if (order) {
          if (ordersMap.has(order.id)) {
            const existing = ordersMap.get(order.id)!;
            existing.items_count += 1;
            existing.shop_revenue += Number(item.subtotal);
          } else {
            ordersMap.set(order.id, {
              id: order.id,
              order_number: order.order_number,
              total_amount: order.total_amount,
              status: order.status,
              created_at: order.created_at,
              items_count: 1,
              shop_revenue: Number(item.subtotal),
            });
          }
        }
      });

      const orders = Array.from(ordersMap.values());
      const totalRevenue = orders.reduce((sum, o) => sum + o.shop_revenue, 0);
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const completedOrders = orders.filter(o => o.status === 'delivered').length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Views
      const totalViews = products?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0;
      const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

      // Low stock products (less than 5)
      const lowStockProducts = products?.filter(p => p.stock_quantity < 5).length || 0;

      // Revenue by day (last 7 days)
      const revenueByDay = getRevenueByDay(orders);

      // Top products
      const productSales = new Map<string, { name: string; sales: number; revenue: number }>();
      orderItems?.forEach(item => {
        const order = item.orders as any;
        if (order && order.status !== 'cancelled') {
          if (productSales.has(item.product_id)) {
            const existing = productSales.get(item.product_id)!;
            existing.sales += item.quantity;
            existing.revenue += Number(item.subtotal);
          } else {
            productSales.set(item.product_id, {
              name: item.product_name,
              sales: item.quantity,
              revenue: Number(item.subtotal),
            });
          }
        }
      });

      const topProducts = Array.from(productSales.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Recent orders
      const recentOrders = orders
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      return {
        totalRevenue,
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        averageOrderValue,
        totalViews,
        conversionRate,
        lowStockProducts,
        revenueByDay,
        topProducts,
        recentOrders,
      };
    },
    enabled: !!shopId,
  });
}

function getEmptyStats(): SellerStats {
  return {
    totalRevenue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
    totalViews: 0,
    conversionRate: 0,
    lowStockProducts: 0,
    revenueByDay: [],
    topProducts: [],
    recentOrders: [],
  };
}

function getRevenueByDay(orders: any[]): { date: string; revenue: number; orders: number }[] {
  const last7Days: { date: string; revenue: number; orders: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at).toISOString().split('T')[0];
      return orderDate === dateStr && o.status !== 'cancelled';
    });

    last7Days.push({
      date: dateStr,
      revenue: dayOrders.reduce((sum, o) => sum + o.shop_revenue, 0),
      orders: dayOrders.length,
    });
  }

  return last7Days;
}
