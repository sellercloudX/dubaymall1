import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/hooks/useShop';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ShoppingCart, Package, Truck, CheckCircle, Clock, 
  Eye, MapPin, Phone, User, Copy, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DeliveryOTPGenerator } from '@/components/delivery/DeliveryOTPGenerator';
import { OrderReceipt } from '@/components/orders/OrderReceipt';

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  shipping_address: any;
  notes: string;
  created_at: string;
  delivery_confirmed_at: string | null;
  delivery_otp: string | null;
  user_id: string;
}

export function SellerOrders() {
  const { shop } = useShop();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showReceipt, setShowReceipt] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['seller-orders', shop?.id],
    queryFn: async () => {
      if (!shop) return [];

      // Get products for this shop
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('shop_id', shop.id);

      if (!products?.length) return [];

      const productIds = products.map(p => p.id);

      // Get order items for these products
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id')
        .in('product_id', productIds);

      if (!orderItems?.length) return [];

      const orderIds = [...new Set(orderItems.map(oi => oi.order_id))];

      // Get orders
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ordersData || [];
    },
    enabled: !!shop,
  });

  const { data: orderItems } = useQuery({
    queryKey: ['seller-order-items', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder || !shop) return [];

      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('shop_id', shop.id);

      if (!products?.length) return [];

      const productIds = products.map(p => p.id);

      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', selectedOrder.id)
        .in('product_id', productIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrder && !!shop,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      toast.success('Holat yangilandi');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Xatolik');
    },
  });

  const filteredOrders = orders?.filter(order => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Kutilmoqda</Badge>;
      case 'confirmed':
        return <Badge className="bg-primary text-primary-foreground"><Package className="h-3 w-3 mr-1" /> Tasdiqlangan</Badge>;
      case 'processing':
        return <Badge className="bg-warning text-warning-foreground"><Package className="h-3 w-3 mr-1" /> Tayyorlanmoqda</Badge>;
      case 'shipped':
        return <Badge className="bg-accent text-accent-foreground"><Truck className="h-3 w-3 mr-1" /> Jo'natildi</Badge>;
      case 'out_for_delivery':
        return <Badge className="bg-secondary text-secondary-foreground"><Truck className="h-3 w-3 mr-1" /> Yetkazilmoqda</Badge>;
      case 'delivered':
        return <Badge className="bg-primary text-primary-foreground"><CheckCircle className="h-3 w-3 mr-1" /> Yetkazildi</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Bekor qilindi</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-primary text-primary-foreground">To'langan</Badge>;
      case 'pending':
        return <Badge variant="secondary">Kutilmoqda</Badge>;
      case 'cash_on_delivery':
        return <Badge variant="outline">Yetkazganda</Badge>;
      case 'failed':
        return <Badge variant="destructive">Muvaffaqiyatsiz</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const orderStats = {
    total: orders?.length || 0,
    pending: orders?.filter(o => o.status === 'pending').length || 0,
    processing: orders?.filter(o => ['confirmed', 'processing'].includes(o.status)).length || 0,
    delivered: orders?.filter(o => o.status === 'delivered').length || 0,
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Jami buyurtmalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orderStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Yangi
            </CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-2xl font-bold text-warning">{orderStats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Jarayonda
            </CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-2xl font-bold text-primary">{orderStats.processing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Yetkazildi
            </CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-2xl font-bold text-primary">{orderStats.delivered}</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Buyurtmalar
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Holat bo'yicha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="pending">Kutilmoqda</SelectItem>
                <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
                <SelectItem value="processing">Tayyorlanmoqda</SelectItem>
                <SelectItem value="shipped">Jo'natildi</SelectItem>
                <SelectItem value="out_for_delivery">Yetkazilmoqda</SelectItem>
                <SelectItem value="delivered">Yetkazildi</SelectItem>
                <SelectItem value="cancelled">Bekor qilindi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredOrders?.length ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Buyurtmalar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyurtma</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>To'lov</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.order_number}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {order.total_amount.toLocaleString()} so'm
                      </TableCell>
                      <TableCell>{getPaymentBadge(order.payment_status || 'pending')}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Ko'rish
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buyurtma: {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6 mt-4">
              {/* Status & Payment */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Holat</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">To'lov</p>
                  {getPaymentBadge(selectedOrder.payment_status || 'pending')}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">To'lov usuli</p>
                  <Badge variant="outline" className="capitalize">
                    {selectedOrder.payment_method || 'Noma\'lum'}
                  </Badge>
                </div>
              </div>

              {/* Update Status */}
              <div>
                <p className="text-sm font-medium mb-2">Holatni yangilash</p>
                <Select 
                  value={selectedOrder.status}
                  onValueChange={(value) => {
                    updateStatusMutation.mutate({ orderId: selectedOrder.id, status: value });
                    setSelectedOrder({ ...selectedOrder, status: value });
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Kutilmoqda</SelectItem>
                    <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
                    <SelectItem value="processing">Tayyorlanmoqda</SelectItem>
                    <SelectItem value="shipped">Jo'natildi</SelectItem>
                    <SelectItem value="out_for_delivery">Yetkazilmoqda</SelectItem>
                    <SelectItem value="delivered">Yetkazildi</SelectItem>
                    <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* OTP Generator */}
              {['shipped', 'out_for_delivery'].includes(selectedOrder.status) && (
                <DeliveryOTPGenerator 
                  orderId={selectedOrder.id} 
                  orderNumber={selectedOrder.order_number}
                  currentOTP={selectedOrder.delivery_otp}
                  isDelivered={selectedOrder.status === 'delivered'}
                />
              )}

              {/* Shipping Address */}
              {selectedOrder.shipping_address && (
                <div className="border rounded-lg p-4 space-y-2">
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Yetkazish manzili
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {selectedOrder.shipping_address.name}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {selectedOrder.shipping_address.phone}
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrder.shipping_address.phone);
                          toast.success('Nusxa olindi');
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </p>
                    <p>
                      {selectedOrder.shipping_address.region}, {selectedOrder.shipping_address.city}
                    </p>
                    <p>{selectedOrder.shipping_address.address}</p>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <p className="font-medium mb-3">Mahsulotlar</p>
                <div className="space-y-2">
                  {orderItems?.map((item: OrderItem) => (
                    <div key={item.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.product_price.toLocaleString()} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">{item.subtotal.toLocaleString()} so'm</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-2 border-t">
                  <p className="font-bold">Jami:</p>
                  <p className="text-xl font-bold">{selectedOrder.total_amount.toLocaleString()} so'm</p>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-1">Izoh:</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Receipt */}
              <div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowReceipt(!showReceipt)}
                  className="gap-1 mb-3"
                >
                  <Printer className="h-3 w-3" /> {showReceipt ? 'Kvitansiyani yashirish' : 'Kvitansiya'}
                </Button>
                {showReceipt && orderItems && (
                  <OrderReceipt order={selectedOrder} items={orderItems} />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
