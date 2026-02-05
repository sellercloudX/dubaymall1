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
import { useAuth } from '@/contexts/AuthContext';
 import { useAdminPermissions } from '@/hooks/useAdminPermissions';
 import { Shield, Users, Package, Store, ShoppingCart, BarChart3, DollarSign, Wallet, Crown, Image, Zap, Globe, FileText, UserCheck, Settings } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-max">
               {hasPermission('can_manage_finances') && (
                 <TabsTrigger value="analytics" className="gap-2">
                   <BarChart3 className="h-4 w-4" />
                   <span className="hidden sm:inline">Analitika</span>
                 </TabsTrigger>
               )}
               {hasPermission('can_manage_content') && (
                 <>
                   <TabsTrigger value="site-stats" className="gap-2">
                     <Globe className="h-4 w-4" />
                     <span className="hidden sm:inline">Sayt</span>
                   </TabsTrigger>
                   <TabsTrigger value="blog" className="gap-2">
                     <FileText className="h-4 w-4" />
                     <span className="hidden sm:inline">Blog</span>
                   </TabsTrigger>
                   <TabsTrigger value="banners" className="gap-2">
                     <Image className="h-4 w-4" />
                     <span className="hidden sm:inline">Bannerlar</span>
                   </TabsTrigger>
                   <TabsTrigger value="flashsales" className="gap-2">
                     <Zap className="h-4 w-4" />
                     <span className="hidden sm:inline">Aksiyalar</span>
                   </TabsTrigger>
                 </>
               )}
               {hasPermission('can_manage_finances') && (
                 <>
                   <TabsTrigger value="financials" className="gap-2">
                     <Wallet className="h-4 w-4" />
                     <span className="hidden sm:inline">Moliya</span>
                   </TabsTrigger>
                   <TabsTrigger value="monetization" className="gap-2">
                     <DollarSign className="h-4 w-4" />
                     <span className="hidden sm:inline">Monetizatsiya</span>
                   </TabsTrigger>
                   <TabsTrigger value="sellercloud" className="gap-2">
                     <Crown className="h-4 w-4" />
                     <span className="hidden sm:inline">SellerCloudX</span>
                   </TabsTrigger>
                 </>
               )}
               {hasPermission('can_manage_users') && (
                 <TabsTrigger value="users" className="gap-2">
                   <Users className="h-4 w-4" />
                   <span className="hidden sm:inline">Foydalanuvchilar</span>
                 </TabsTrigger>
               )}
               {hasPermission('can_manage_activations') && (
                 <TabsTrigger value="activations" className="gap-2">
                   <UserCheck className="h-4 w-4" />
                   <span className="hidden sm:inline">Aktivatsiya</span>
                 </TabsTrigger>
               )}
               {hasPermission('can_manage_products') && (
                 <TabsTrigger value="products" className="gap-2">
                   <Package className="h-4 w-4" />
                   <span className="hidden sm:inline">Mahsulotlar</span>
                 </TabsTrigger>
               )}
               {hasPermission('can_manage_shops') && (
                 <TabsTrigger value="shops" className="gap-2">
                   <Store className="h-4 w-4" />
                   <span className="hidden sm:inline">Do'konlar</span>
                 </TabsTrigger>
               )}
               {hasPermission('can_manage_orders') && (
                 <TabsTrigger value="orders" className="gap-2">
                   <ShoppingCart className="h-4 w-4" />
                   <span className="hidden sm:inline">Buyurtmalar</span>
                 </TabsTrigger>
               )}
               {isSuperAdmin && (
                 <TabsTrigger value="admins" className="gap-2">
                   <Settings className="h-4 w-4" />
                   <span className="hidden sm:inline">Adminlar</span>
                 </TabsTrigger>
               )}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="site-stats">
            <SiteAnalytics />
          </TabsContent>

          <TabsContent value="blog">
            <BlogManagement />
          </TabsContent>

          <TabsContent value="financials">
            <AdminFinancials />
          </TabsContent>

          <TabsContent value="monetization">
            <MonetizationSettings />
          </TabsContent>

          <TabsContent value="banners">
            <BannersManagement />
          </TabsContent>

          <TabsContent value="flashsales">
            <FlashSalesManagement />
          </TabsContent>

          <TabsContent value="sellercloud">
            <SellerCloudManagement />
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
