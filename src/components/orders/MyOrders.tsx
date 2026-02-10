import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DeliveryOTPConfirm } from '@/components/delivery/DeliveryOTPConfirm';
import { Package, Truck, Clock, CheckCircle, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

const ORDER_STEPS = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

const statusConfig: Record<string, { color: string; label: string; icon: any; step: number }> = {
  pending: { color: 'bg-warning text-warning-foreground', label: 'Kutilmoqda', icon: Clock, step: 0 },
  processing: { color: 'bg-primary text-primary-foreground', label: 'Tayyorlanmoqda', icon: Package, step: 1 },
  shipped: { color: 'bg-accent text-accent-foreground', label: "Jo'natildi", icon: Truck, step: 2 },
  out_for_delivery: { color: 'bg-secondary text-secondary-foreground', label: 'Yetkazilmoqda', icon: Truck, step: 3 },
  delivered: { color: 'bg-primary text-primary-foreground', label: 'Yetkazildi', icon: CheckCircle, step: 4 },
  cancelled: { color: 'bg-destructive text-destructive-foreground', label: 'Bekor qilindi', icon: ShoppingCart, step: -1 },
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
            <Card key={order.id} className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Buyurtma #{order.order_number}
                  </CardTitle>
                  <Badge className="bg-warning text-warning-foreground">Yetkazilmoqda</Badge>
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

          const currentStep = statusConfig[order.status]?.step ?? 0;
          const isCancelled = order.status === 'cancelled';

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
                      <p className="text-xs text-primary mt-1">
                        ✓ OTP bilan tasdiqlangan
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress tracker */}
                {!isCancelled && (
                  <div className="flex items-center gap-1 py-2">
                    {ORDER_STEPS.map((step, i) => {
                      const done = i <= currentStep;
                      const StepIcon = statusConfig[step]?.icon || Clock;
                      return (
                        <div key={step} className="flex items-center flex-1">
                          <div className={`flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            <StepIcon className="h-3 w-3" />
                          </div>
                          {i < ORDER_STEPS.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-1 rounded ${i < currentStep ? 'bg-primary' : 'bg-muted'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

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

                {/* Payment info */}
                {order.payment_method && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>To'lov: {order.payment_method === 'cash' ? 'Naqd' : order.payment_method.toUpperCase()}</span>
                    <span>{order.payment_status === 'paid' ? '✓ To\'langan' : order.payment_status === 'cash_on_delivery' ? 'Yetkazganda' : 'Kutilmoqda'}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}