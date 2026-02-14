import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAdminOrders } from '@/hooks/useAdminStats';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ShoppingCart, Package, Truck, CheckCircle, Key, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { DeliveryOTPGenerator } from '@/components/delivery/DeliveryOTPGenerator';

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: 'bg-yellow-500', label: 'Kutilmoqda', icon: ShoppingCart },
  processing: { color: 'bg-blue-500', label: 'Tayyorlanmoqda', icon: Package },
  shipped: { color: 'bg-purple-500', label: "Jo'natildi", icon: Truck },
  out_for_delivery: { color: 'bg-orange-500', label: 'Yetkazilmoqda', icon: Truck },
  delivered: { color: 'bg-green-500', label: 'Yetkazildi', icon: CheckCircle },
  cancelled: { color: 'bg-red-500', label: 'Bekor qilindi', icon: ShoppingCart },
};

export function OrdersManagement() {
  const { data: orders, isLoading } = useAdminOrders();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const queryClient = useQueryClient();

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
      toast.success('Buyurtma holati yangilandi');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (err) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleOTPGenerated = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    setSelectedOrder(null);
  };

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Buyurtmalar boshqaruvi
        </CardTitle>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buyurtma raqami..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Holat bo'yicha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="pending">Kutilmoqda</SelectItem>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Buyurtma №</TableHead>
              <TableHead>Mahsulotlar</TableHead>
              <TableHead>Summa</TableHead>
              <TableHead>To'lov</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>OTP</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders?.map((order) => {
              const StatusIcon = statusConfig[order.status]?.icon || ShoppingCart;
              const hasOTP = order.delivery_otp && order.status === 'out_for_delivery';
              const isDelivered = order.delivery_confirmed_at;
              
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                   <TableCell>
                     <div className="flex flex-col gap-1">
                       {order.order_items?.slice(0, 2).map((item: any) => (
                         <div key={item.id} className="flex items-center gap-2">
                           {item.photo && (
                             <img 
                               src={item.photo} 
                               alt={item.product_name}
                               className="h-8 w-8 rounded object-cover"
                               onError={(e) => (e.currentTarget.style.display = 'none')}
                             />
                           )}
                           <span className="text-xs">{item.product_name}</span>
                         </div>
                       ))}
                       {order.order_items?.length > 2 && (
                         <span className="text-xs text-muted-foreground">+{order.order_items.length - 2} more</span>
                       )}
                     </div>
                   </TableCell>
                   <TableCell className="font-medium">{order.total_amount.toLocaleString()} so'm</TableCell>
                  <TableCell>
                    <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                      {order.payment_status === 'paid' ? "To'langan" : 'Kutilmoqda'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[order.status]?.color || 'bg-gray-500'}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig[order.status]?.label || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isDelivered ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Tasdiqlangan
                      </Badge>
                    ) : hasOTP ? (
                      <Badge variant="outline" className="font-mono">
                        <Key className="h-3 w-3 mr-1" />
                        {order.delivery_otp}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Kutilmoqda</SelectItem>
                          <SelectItem value="processing">Tayyorlanmoqda</SelectItem>
                          <SelectItem value="shipped">Jo'natildi</SelectItem>
                          <SelectItem value="out_for_delivery">Yetkazilmoqda</SelectItem>
                          <SelectItem value="delivered">Yetkazildi</SelectItem>
                          <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {!isDelivered && order.status !== 'cancelled' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Key className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>OTP Yetkazib berish tasdiqi</DialogTitle>
                            </DialogHeader>
                            <DeliveryOTPGenerator
                              orderId={order.id}
                              orderNumber={order.order_number}
                              currentOTP={order.delivery_otp}
                              otpExpiresAt={order.delivery_otp_expires_at}
                              isDelivered={!!order.delivery_confirmed_at}
                              onOTPGenerated={handleOTPGenerated}
                            />
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredOrders?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Buyurtmalar topilmadi</p>
        )}
      </CardContent>
    </Card>
  );
}
