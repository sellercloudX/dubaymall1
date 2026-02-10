import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useActivationStatus } from '@/hooks/useActivationStatus';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DollarSign, MousePointer, ShoppingCart, Wallet, BarChart3, AlertTriangle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import AffiliateProducts from '@/components/blogger/AffiliateProducts';
import MyAffiliateLinks from '@/components/blogger/MyAffiliateLinks';
import CommissionsHistory from '@/components/blogger/CommissionsHistory';
import WithdrawalSection from '@/components/blogger/WithdrawalSection';
import { BloggerAnalytics } from '@/components/blogger/BloggerAnalytics';
import { BloggerBalanceCard } from '@/components/blogger/BloggerBalanceCard';
import useBloggerStats from '@/hooks/useBloggerStats';
import { Button } from '@/components/ui/button';

export default function BloggerDashboard() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { isBlogger, isSeller, loading: rolesLoading } = useUserRoles();
  const { isBloggerApproved, loading: activationLoading } = useActivationStatus();
  const { stats, loading: statsLoading } = useBloggerStats();

  if (authLoading || rolesLoading || activationLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <p>{t.loading}</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  // If user is a seller, redirect them — sellers shouldn't access blogger dashboard
  if (isSeller) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-4">Ruxsat yo'q</h1>
          <p className="text-muted-foreground mb-6">
            Sotuvchi sifatida ro'yxatdan o'tgansiz. Blogger kabineti faqat bloggerlar uchun.
          </p>
          <Button asChild>
            <Link to="/seller">Sotuvchi kabinetiga o'tish</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (!isBlogger) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Blogger kabinetiga kirish</h1>
          <p className="text-muted-foreground mb-6">
            Blogger sifatida ishlash uchun avval aktivatsiyadan o'ting
          </p>
          <Button asChild>
            <Link to="/blogger-activation">Aktivatsiya</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // Activation not approved yet
  if (!isBloggerApproved) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-4">Aktivatsiya tasdiqlanmagan</h1>
          <p className="text-muted-foreground mb-6">
            Sizning blogger profilingiz hali admin tomonidan tasdiqlanmagan. Iltimos kuting yoki aktivatsiya sahifasini tekshiring.
          </p>
          <Button asChild>
            <Link to="/blogger-activation">Aktivatsiya holatini ko'rish</Link>
          </Button>
        </div>
      </Layout>
    );
  }
 
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Blogger Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Affiliate havolalaringiz va daromadingizni boshqaring
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mavjud balans
              </CardTitle>
              <Wallet className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? '...' : `${stats.availableBalance.toLocaleString()} so'm`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Yechib olish mumkin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Kutilayotgan
              </CardTitle>
              <DollarSign className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? '...' : `${stats.pendingBalance.toLocaleString()} so'm`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tasdiqlanmoqda
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Jami bosishlar
              </CardTitle>
              <MousePointer className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? '...' : stats.totalClicks.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Barcha havolalar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Konversiyalar
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? '...' : stats.totalConversions}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sotuvlar soni
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="balance" className="space-y-6">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-max">
              <TabsTrigger value="balance" className="gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Balans</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analitika</span>
              </TabsTrigger>
              <TabsTrigger value="products">Mahsulotlar</TabsTrigger>
              <TabsTrigger value="links">Havolalarim</TabsTrigger>
              <TabsTrigger value="commissions">Komissiyalar</TabsTrigger>
              <TabsTrigger value="withdraw">Yechib olish</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="balance">
            <BloggerBalanceCard />
          </TabsContent>

          <TabsContent value="analytics">
            <BloggerAnalytics />
          </TabsContent>

          <TabsContent value="products">
            <AffiliateProducts />
          </TabsContent>

          <TabsContent value="links">
            <MyAffiliateLinks />
          </TabsContent>

          <TabsContent value="commissions">
            <CommissionsHistory />
          </TabsContent>

          <TabsContent value="withdraw">
            <WithdrawalSection balance={stats.availableBalance} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
