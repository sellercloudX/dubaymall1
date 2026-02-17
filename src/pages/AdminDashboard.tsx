import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminStats } from '@/components/admin/AdminStats';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminFinancials } from '@/components/admin/AdminFinancials';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { SellerCloudManagement } from '@/components/admin/SellerCloudManagement';
import { ActivationsManagement } from '@/components/admin/ActivationsManagement';
import { AdminsManagement } from '@/components/admin/AdminsManagement';
import { StartupMetrics } from '@/components/admin/StartupMetrics';
import { PlatformExpenses } from '@/components/admin/PlatformExpenses';
import { PartnerAnalytics } from '@/components/admin/PartnerAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { Shield, Users, BarChart3, Wallet, Crown, UserCheck, Settings, Zap, TrendingUp, UsersRound } from 'lucide-react';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { permissions, isLoading: permissionsLoading, hasPermission, isSuperAdmin } = useAdminPermissions();

  useEffect(() => {
    if (!loading && !permissionsLoading && !user) {
      navigate('/auth');
    }
  }, [user, loading, permissionsLoading, navigate]);

  if (loading || permissionsLoading) {
    return (
      <Layout>
        <div className="container py-8 text-center">
          <p>Yuklanmoqda...</p>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  if (!permissions) {
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
            <h1 className="text-3xl font-bold">
              {isSuperAdmin ? 'Super Admin Panel' : 'Admin Panel'}
            </h1>
            <p className="text-muted-foreground">SellerCloudX boshqaruv markazi</p>
          </div>
        </div>

        {/* Stats Overview */}
        {hasPermission('can_manage_finances') && (
          <div className="mb-8">
            <AdminStats />
          </div>
        )}

        {/* Management Tabs */}
        <Tabs defaultValue="metrics" className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            {hasPermission('can_manage_finances') && (
              <TabsTrigger value="metrics" className="gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />Metrikalar
              </TabsTrigger>
            )}
            {hasPermission('can_manage_finances') && (
              <TabsTrigger value="analytics" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />Analitika
              </TabsTrigger>
            )}
            {hasPermission('can_manage_finances') && (
              <TabsTrigger value="partners" className="gap-1.5 text-xs">
                <UsersRound className="h-3.5 w-3.5" />Hamkorlar
              </TabsTrigger>
            )}
            {hasPermission('can_manage_users') && (
              <TabsTrigger value="users" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />Foydalanuvchilar
              </TabsTrigger>
            )}
            {hasPermission('can_manage_activations') && (
              <TabsTrigger value="activations" className="gap-1.5 text-xs">
                <UserCheck className="h-3.5 w-3.5" />Aktivatsiya
              </TabsTrigger>
            )}
            {hasPermission('can_manage_finances') && (
              <TabsTrigger value="finance" className="gap-1.5 text-xs">
                <Wallet className="h-3.5 w-3.5" />Moliya
              </TabsTrigger>
            )}
            {hasPermission('can_manage_finances') && (
              <TabsTrigger value="expenses" className="gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" />Xarajatlar
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="admins" className="gap-1.5 text-xs">
                <Settings className="h-3.5 w-3.5" />Adminlar
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="metrics">
            <StartupMetrics />
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="partners">
            <PartnerAnalytics />
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="activations">
            <ActivationsManagement />
          </TabsContent>

          <TabsContent value="finance">
            <Tabs defaultValue="financials" className="space-y-4">
              <TabsList className="h-auto gap-1 p-1">
                <TabsTrigger value="financials" className="text-xs gap-1"><Wallet className="h-3.5 w-3.5" />Daromad</TabsTrigger>
                <TabsTrigger value="sellercloud" className="text-xs gap-1"><Crown className="h-3.5 w-3.5" />SellerCloudX</TabsTrigger>
              </TabsList>
              <TabsContent value="financials"><AdminFinancials /></TabsContent>
              <TabsContent value="sellercloud"><SellerCloudManagement /></TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="expenses">
            <PlatformExpenses />
          </TabsContent>

          <TabsContent value="admins">
            <AdminsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
