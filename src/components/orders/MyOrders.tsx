import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DeliveryOTPConfirm } from '@/components/delivery/DeliveryOTPConfirm';
import { Package, Truck, Clock, CheckCircle, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: 'bg-yellow-500', label: 'Kutilmoqda', icon: Clock },
  processing: { color: 'bg-blue-500', label: 'Tayyorlanmoqda', icon: Package },
  shipped: { color: 'bg-purple-500', label: "Jo'natildi", icon: Truck },
  out_for_delivery: { color: 'bg-orange-500', label: 'Yetkazilmoqda', icon: Truck },
  delivered: { color: 'bg-green-500', label: 'Yetkazildi', icon: CheckCircle },
  cancelled: { color: 'bg-red-500', label: 'Bekor qilindi', icon: ShoppingCart },
};

export function MyOrders() {
  const { user } = useAuth();

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            product_price,
            quantity,
            subtotal
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </CardContent>
      </Card>
    );
  }

  if (!orders?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Hali buyurtmalar yo'q</p>
        </CardContent>
      </Card>
    );
  }

  // Find orders that need OTP confirmation
  const pendingDeliveryOrders = orders.filter(
    order => order.status === 'out_for_delivery' && !order.delivery_confirmed_at
  );

  return (
    <div className="space-y-6">
      {/* Pending Delivery Confirmation */}
      {pendingDeliveryOrders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-500" />
            Yetkazib berishni tasdiqlang
          </h3>
          {pendingDeliveryOrders.map(order => (
            <Card key={order.id} className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Buyurtma #{order.order_number}
                  </CardTitle>
                  <Badge className="bg-orange-500">Yetkazilmoqda</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <DeliveryOTPConfirm
                  orderId={order.id}
                  orderNumber={order.order_number}
                  onConfirmed={() => refetch()}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* All Orders */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Barcha buyurtmalar</h3>
        {orders.map(order => {
          const StatusIcon = statusConfig[order.status]?.icon || Clock;
          const isDelivered = !!order.delivery_confirmed_at;

          return (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-muted-foreground">
                      #{order.order_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={statusConfig[order.status]?.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig[order.status]?.label}
                    </Badge>
                    {isDelivered && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ OTP bilan tasdiqlangan
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.product_name} × {item.quantity}</span>
                    <span className="font-medium">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Jami</span>
                  <span className="text-primary">{formatPrice(order.total_amount)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}