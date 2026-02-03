import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminStats } from '@/components/admin/AdminStats';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { ProductsModeration } from '@/components/admin/ProductsModeration';
import { ShopsManagement } from '@/components/admin/ShopsManagement';
import { OrdersManagement } from '@/components/admin/OrdersManagement';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Users, Package, Store, ShoppingCart, BarChart3 } from 'lucide-react';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        setIsAdmin(!!data);
      } catch (err) {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    };

    if (!loading) {
      checkAdminRole();
    }
  }, [user, loading]);

  if (loading || checking) {
    return (
      <Layout>
        <div className="container py-8 text-center">
          <p>Yuklanmoqda...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Ruxsat yo'q</h1>
          <p className="text-muted-foreground">Bu sahifaga faqat adminlar kira oladi.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Platformani boshqarish markazi</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <AdminStats />
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Foydalanuvchilar</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Mahsulotlar</span>
            </TabsTrigger>
            <TabsTrigger value="shops" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Do'konlar</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Buyurtmalar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="products">
            <ProductsModeration />
          </TabsContent>

          <TabsContent value="shops">
            <ShopsManagement />
          </TabsContent>

          <TabsContent value="orders">
            <OrdersManagement />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
