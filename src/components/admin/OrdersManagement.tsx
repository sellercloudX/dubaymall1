import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminOrders } from '@/hooks/useAdminStats';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ShoppingCart, Package, Truck, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: 'bg-yellow-500', label: 'Kutilmoqda', icon: ShoppingCart },
  processing: { color: 'bg-blue-500', label: 'Tayyorlanmoqda', icon: Package },
  shipped: { color: 'bg-purple-500', label: "Jo'natildi", icon: Truck },
  delivered: { color: 'bg-green-500', label: 'Yetkazildi', icon: CheckCircle },
  cancelled: { color: 'bg-red-500', label: 'Bekor qilindi', icon: ShoppingCart },
};

export function OrdersManagement() {
  const { data: orders, isLoading } = useAdminOrders();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
              <TableHead>Sana</TableHead>
              <TableHead>Holatni o'zgartirish</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders?.map((order) => {
              const StatusIcon = statusConfig[order.status]?.icon || ShoppingCart;
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                  <TableCell>{order.order_items?.length || 0} ta</TableCell>
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
                  <TableCell>{format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Kutilmoqda</SelectItem>
                        <SelectItem value="processing">Tayyorlanmoqda</SelectItem>
                        <SelectItem value="shipped">Jo'natildi</SelectItem>
                        <SelectItem value="delivered">Yetkazildi</SelectItem>
                        <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                      </SelectContent>
                    </Select>
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
