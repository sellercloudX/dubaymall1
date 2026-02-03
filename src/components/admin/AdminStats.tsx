import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Users, Store, Package, ShoppingCart, DollarSign, Clock } from 'lucide-react';

export function AdminStats() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="pt-6">
            <div className="h-16 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  const statItems = [
    { label: 'Foydalanuvchilar', value: stats?.usersCount || 0, icon: Users, color: 'text-blue-500' },
    { label: "Do'konlar", value: stats?.shopsCount || 0, icon: Store, color: 'text-green-500' },
    { label: 'Mahsulotlar', value: stats?.productsCount || 0, icon: Package, color: 'text-purple-500' },
    { label: 'Buyurtmalar', value: stats?.totalOrders || 0, icon: ShoppingCart, color: 'text-orange-500' },
    { label: 'Umumiy daromad', value: `${(stats?.totalRevenue || 0).toLocaleString()} so'm`, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Kutilmoqda', value: stats?.pendingOrders || 0, icon: Clock, color: 'text-yellow-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statItems.map((item, idx) => (
        <Card key={idx}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
