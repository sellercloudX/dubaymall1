import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminStats } from '@/components/admin/AdminStats';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminFinancials } from '@/components/admin/AdminFinancials';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { ProductsModeration } from '@/components/admin/ProductsModeration';
import { ShopsManagement } from '@/components/admin/ShopsManagement';
import { OrdersManagement } from '@/components/admin/OrdersManagement';
import MonetizationSettings from '@/components/admin/MonetizationSettings';
import { SellerCloudManagement } from '@/components/admin/SellerCloudManagement';
import { BannersManagement } from '@/components/admin/BannersManagement';
import { FlashSalesManagement } from '@/components/admin/FlashSalesManagement';
import { SiteAnalytics } from '@/components/admin/SiteAnalytics';
import { BlogManagement } from '@/components/admin/BlogManagement';
 import { ActivationsManagement } from '@/components/admin/ActivationsManagement';
 import { AdminsManagement } from '@/components/admin/AdminsManagement';
 import { PartnersDetails } from '@/components/admin/PartnersDetails';
 import { CategoryCommissions } from '@/components/admin/CategoryCommissions';
 import { ShippingRatesManagement } from '@/components/admin/ShippingRatesManagement';
import { useAuth } from '@/contexts/AuthContext';
 import { useAdminPermissions } from '@/hooks/useAdminPermissions';
  import { Shield, Users, Package, Store, ShoppingCart, BarChart3, DollarSign, Wallet, Crown, Image, Zap, Globe, FileText, UserCheck, Settings, Percent, Truck, UsersRound } from 'lucide-react';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
   const { permissions, isLoading: permissionsLoading, hasPermission, isSuperAdmin } = useAdminPermissions();

   if (loading || permissionsLoading) {
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
            <p className="text-muted-foreground">Platformani boshqarish markazi</p>
          </div>
        </div>

        {/* Stats Overview */}
         {hasPermission('can_manage_finances') && (
           <div className="mb-8">
             <AdminStats />
           </div>
         )}

        {/* Management Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            {/* Analitika guruhi */}
            {hasPermission('can_manage_finances') && (
              <>
                <TabsTrigger value="analytics" className="gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5" />Analitika
                </TabsTrigger>
                <TabsTrigger value="partners" className="gap-1.5 text-xs">
                  <UsersRound className="h-3.5 w-3.5" />Hamkorlar
                </TabsTrigger>
              </>
            )}
            {hasPermission('can_manage_content') && (
              <TabsTrigger value="content" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />Kontent
              </TabsTrigger>
            )}
            {hasPermission('can_manage_finances') && (
              <TabsTrigger value="finance" className="gap-1.5 text-xs">
                <Wallet className="h-3.5 w-3.5" />Moliya
              </TabsTrigger>
            )}
            {/* Boshqaruv guruhi */}
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
            {hasPermission('can_manage_products') && (
              <TabsTrigger value="products" className="gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5" />Mahsulotlar
              </TabsTrigger>
            )}
            {hasPermission('can_manage_shops') && (
              <TabsTrigger value="shops" className="gap-1.5 text-xs">
                <Store className="h-3.5 w-3.5" />Do'konlar
              </TabsTrigger>
            )}
            {hasPermission('can_manage_orders') && (
              <TabsTrigger value="orders" className="gap-1.5 text-xs">
                <ShoppingCart className="h-3.5 w-3.5" />Buyurtmalar
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="admins" className="gap-1.5 text-xs">
                <Settings className="h-3.5 w-3.5" />Adminlar
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="partners">
            <PartnersDetails />
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>

          {/* Kontent sub-tabs */}
          <TabsContent value="content">
            <Tabs defaultValue="site-stats" className="space-y-4">
              <TabsList className="h-auto gap-1 p-1">
                <TabsTrigger value="site-stats" className="text-xs gap-1"><Globe className="h-3.5 w-3.5" />Sayt</TabsTrigger>
                <TabsTrigger value="blog" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Blog</TabsTrigger>
                <TabsTrigger value="banners" className="text-xs gap-1"><Image className="h-3.5 w-3.5" />Bannerlar</TabsTrigger>
                <TabsTrigger value="flashsales" className="text-xs gap-1"><Zap className="h-3.5 w-3.5" />Aksiyalar</TabsTrigger>
              </TabsList>
              <TabsContent value="site-stats"><SiteAnalytics /></TabsContent>
              <TabsContent value="blog"><BlogManagement /></TabsContent>
              <TabsContent value="banners"><BannersManagement /></TabsContent>
              <TabsContent value="flashsales"><FlashSalesManagement /></TabsContent>
            </Tabs>
          </TabsContent>

          {/* Moliya sub-tabs */}
          <TabsContent value="finance">
            <Tabs defaultValue="financials" className="space-y-4">
              <TabsList className="h-auto gap-1 p-1">
                <TabsTrigger value="financials" className="text-xs gap-1"><Wallet className="h-3.5 w-3.5" />Moliya</TabsTrigger>
                <TabsTrigger value="monetization" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Monetizatsiya</TabsTrigger>
                <TabsTrigger value="category-commissions" className="text-xs gap-1"><Percent className="h-3.5 w-3.5" />Komissiyalar</TabsTrigger>
                <TabsTrigger value="shipping" className="text-xs gap-1"><Truck className="h-3.5 w-3.5" />Yetkazish</TabsTrigger>
                <TabsTrigger value="sellercloud" className="text-xs gap-1"><Crown className="h-3.5 w-3.5" />SellerCloudX</TabsTrigger>
              </TabsList>
              <TabsContent value="financials"><AdminFinancials /></TabsContent>
              <TabsContent value="monetization"><MonetizationSettings /></TabsContent>
              <TabsContent value="category-commissions"><CategoryCommissions /></TabsContent>
              <TabsContent value="shipping"><ShippingRatesManagement /></TabsContent>
              <TabsContent value="sellercloud"><SellerCloudManagement /></TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

           <TabsContent value="activations">
             <ActivationsManagement />
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
           
           <TabsContent value="admins">
             <AdminsManagement />
           </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
