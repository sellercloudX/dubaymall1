import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { MyOrders } from '@/components/orders/MyOrders';
import { Store, Users, ShoppingCart, TrendingUp, Plus, Loader2, Package } from 'lucide-react';

type UserRole = 'seller' | 'blogger' | 'buyer' | 'admin';

interface RoleData {
  role: UserRole;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchUserRoles();
    }
  }, [user, authLoading, navigate]);

  const fetchUserRoles = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!error && data) {
      setRoles((data as RoleData[]).map(r => r.role));
    }
    setLoading(false);
  };

  const addRole = async (role: UserRole) => {
    if (!user || roles.includes(role)) return;

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role });

    if (!error) {
      setRoles([...roles, role]);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isSeller = roles.includes('seller');
  const isBlogger = roles.includes('blogger');

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t.dashboard}</h1>
          <p className="text-muted-foreground mt-2">
            Xush kelibsiz, {user?.email}
          </p>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="h-4 w-4" />
              Buyurtmalarim
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Users className="h-4 w-4" />
              Rollar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <MyOrders />
          </TabsContent>

          <TabsContent value="roles">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Buyurtmalar</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Jami buyurtmalar</p>
                </CardContent>
              </Card>
              
              {isSeller && (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Mahsulotlar</CardTitle>
                      <Store className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">0</div>
                      <p className="text-xs text-muted-foreground">Faol mahsulotlar</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Sotuvlar</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">0 so'm</div>
                      <p className="text-xs text-muted-foreground">Bu oy</p>
                    </CardContent>
                  </Card>
                </>
              )}
              
              {isBlogger && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Komissiya</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0 so'm</div>
                    <p className="text-xs text-muted-foreground">Jami daromad</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Role Selection */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">{t.selectRole}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`cursor-pointer transition-all ${isSeller ? 'ring-2 ring-primary' : 'hover:shadow-lg'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Store className="h-8 w-8 text-primary" />
                      {isSeller && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Faol</span>}
                    </div>
                    <CardTitle>{t.seller}</CardTitle>
                    <CardDescription>{t.sellerDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!isSeller && (
                      <Button onClick={() => addRole('seller')} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Sotuvchi bo'lish
                      </Button>
                    )}
                    {isSeller && (
                      <Button variant="outline" className="w-full" onClick={() => navigate('/seller')}>
                        Do'konni boshqarish
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${isBlogger ? 'ring-2 ring-primary' : 'hover:shadow-lg'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Users className="h-8 w-8 text-accent" />
                      {isBlogger && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Faol</span>}
                    </div>
                    <CardTitle>{t.blogger}</CardTitle>
                    <CardDescription>{t.bloggerDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!isBlogger && (
                      <Button onClick={() => addRole('blogger')} variant="outline" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Blogger bo'lish
                      </Button>
                    )}
                    {isBlogger && (
                      <Button variant="outline" className="w-full" onClick={() => navigate('/blogger')}>
                        Affiliate paneli
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="ring-2 ring-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <ShoppingCart className="h-8 w-8 text-success" />
                      <span className="text-xs bg-success text-success-foreground px-2 py-1 rounded">Asosiy</span>
                    </div>
                    <CardTitle>{t.buyer}</CardTitle>
                    <CardDescription>{t.buyerDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/marketplace')}>
                      Marketplace'ga o'tish
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
